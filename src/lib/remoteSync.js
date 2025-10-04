// src/lib/remoteSync.js
import { supabase } from "./supabase.js";

/** 서버 테이블 이름 */
const TABLE = "user_state_v1";

/**
 * 서버의 사용자 상태를 로드하거나, 없으면 초기 스냅샷으로 생성합니다.
 * @param {string} userId
 * @param {object} initialSnapshot  // { products, lots, sales, iorec, partners, payments, categories, brands, couriers, lot_seq }
 * @returns {Promise<object>}       // 서버에 저장된 최종 상태(row)
 */
export async function initUserState(userId, initialSnapshot = {}) {
  // 1) 내 행이 있는지 확인
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116: row not found
    console.error("initUserState: select error", error);
  }

  if (data) {
    // 이미 서버에 있으면 그걸 쓰자 (서버가 기준)
    return data;
  }

  // 2) 없으면 지금 로컬 스냅샷으로 생성
  const row = {
    user_id: userId,
    products: initialSnapshot.products ?? [],
    lots: initialSnapshot.lots ?? [],
    sales: initialSnapshot.sales ?? [],
    iorec: initialSnapshot.iorec ?? [],
    partners: initialSnapshot.partners ?? [],
    payments: initialSnapshot.payments ?? [],
    categories: initialSnapshot.categories ?? [],
    brands: initialSnapshot.brands ?? [],
    couriers: initialSnapshot.couriers ?? [],
    lot_seq: Number(initialSnapshot.lot_seq ?? 0),
  };

  const { data: upserted, error: upErr } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (upErr) {
    console.error("initUserState: upsert error", upErr);
    throw upErr;
  }
  return upserted;
}

// ---- 저장(업서트) ----
let debounceTimer = null;
let pending = {}; // { key: value } 형식으로 모아뒀다가 한 번에 저장
let lastPushAt = 0;

/**
 * 부분 저장(딥머지 아님, 지정한 컬럼만 갱신). 300ms 디바운스.
 * @param {string} userId
 * @param {object} partial  // 예: { partners: [...]} 또는 { products: [...] }
 */
export function queueSavePartial(userId, partial) {
  pending = { ...pending, ...partial };
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const payload = { user_id: userId, ...pending };
    pending = {};
    try {
      const { error } = await supabase
        .from(TABLE)
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      lastPushAt = Date.now();
    } catch (e) {
      console.error("queueSavePartial upsert error", e);
    }
  }, 300);
}

/**
 * 실시간 구독: 다른 곳(다른 PC/브라우저)에서 변경되면 콜백 호출
 * @param {string} userId
 * @param {(row: object)=>void} onChange
 * @returns {()=>void} unsubscribe
 */
export function subscribeUserState(userId, onChange) {
  const channel = supabase
    .channel(`user_state_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        // 내가 방금 저장한 내용이 리플리케이트되어 들어오는 경우도 있음 → 그건 무시해도 OK
        const row = payload.new || payload.old;
        if (!row) return;
        // lastPushAt 이후 바로 들어온 echo는 대부분 동일 데이터 → 그냥 덮어써도 문제는 없음.
        onChange(row);
      }
    )
    .subscribe();

  return () => {
    try { supabase.removeChannel(channel); } catch {}
  };
}
