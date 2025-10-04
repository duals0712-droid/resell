// src/lib/remoteSync.js
import { supabase } from "./supabase.js";

const TABLE = "user_state_v1";
let lastServerUpdatedAt = null;

// ---- 초기 로드 ----
export async function initUserState(userId, initialSnapshot = {}) {
  let existing = null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error) {
      if (String(error.code) !== "PGRST116") throw error; // row not found 이외 에러면 throw
    } else {
      existing = data || null;
    }
  } catch (e) {
    throw e;
  }

  if (existing) {
    lastServerUpdatedAt = existing.updated_at || null;
    return existing;
  }

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
    lot_seq: initialSnapshot.lot_seq ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insErr } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();

  if (insErr) {
    console.error("initUserState: insert error", insErr);
    throw insErr;
  }

  lastServerUpdatedAt = inserted.updated_at || null;
  return inserted;
}

// ---- 저장(업서트) + 최신성 기록 ----
let debounceTimer = null;
let pending = {};

export function queueSavePartial(userId, partial) {
  pending = { ...pending, ...partial };
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    const payload = { user_id: userId, ...pending, updated_at: new Date().toISOString() };
    pending = {};
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .upsert(payload, { onConflict: "user_id" })
        .select("updated_at")
        .single();
      if (error) throw error;
      if (data?.updated_at) {
        lastServerUpdatedAt = data.updated_at;
      }
    } catch (e) {
      console.error("queueSavePartial upsert error", e);
    }
  }, 300);
}

// ---- 실시간 구독: 더 '새로운' 것만 반영 ----
export function subscribeUserState(userId, onChange) {
  const onlyIfNewer = (row) => {
    if (!row) return;
    const rAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
    const lAt = lastServerUpdatedAt ? new Date(lastServerUpdatedAt).getTime() : 0;
    if (rAt <= lAt) return; // 과거/동일 타임스탬프는 무시
    lastServerUpdatedAt = row.updated_at;
    onChange(row);
  };

  const channel = supabase
    .channel(`user_state_${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => onlyIfNewer(payload.new)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => onlyIfNewer(payload.new)
    )
    .subscribe();

  return () => {
    try { supabase.removeChannel(channel); } catch {}
  };
}
