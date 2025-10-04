// src/lib/remoteSync.js
import { supabase } from "./supabase.js";

const TABLE = "user_state_v1";

// 클라이언트가 마지막으로 적용한 서버 updated_at
let lastAppliedAt = 0;

// 1) 초기 로드(비파괴)
export async function initUserState(userId, initialSnapshot = {}) {
  const { data: existed, error: selErr } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existed && !selErr) {
    const ts = existed.updated_at ? Date.parse(existed.updated_at) : Date.now();
    if (!Number.isNaN(ts)) lastAppliedAt = ts;
    return existed;
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
    out_later: initialSnapshot.out_later ?? [],
    lot_seq: Number(initialSnapshot.lot_seq ?? 0),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insErr } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();

  if (insErr && String(insErr.code) === "23505") {
    const { data } = await supabase.from(TABLE).select("*").eq("user_id", userId).single();
    const ts = data?.updated_at ? Date.parse(data.updated_at) : Date.now();
    if (!Number.isNaN(ts)) lastAppliedAt = ts;
    return data;
  }
  if (insErr) throw insErr;

  const ts = inserted?.updated_at ? Date.parse(inserted.updated_at) : Date.now();
  if (!Number.isNaN(ts)) lastAppliedAt = ts;
  return inserted;
}

// 2) 부분 저장(디바운스 업서트)
let debounceTimer = null;
let pending = {};

export function queueSavePartial(userId, partial) {
  pending = { ...pending, ...partial };
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    const payload = {
      user_id: userId,
      ...pending,
      updated_at: new Date().toISOString(),
    };
    pending = {};

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .upsert(payload, { onConflict: "user_id" })
        .select("updated_at")
        .single();

      if (error) throw error;
      const ts = data?.updated_at ? Date.parse(data.updated_at) : Date.now();
      if (!Number.isNaN(ts)) lastAppliedAt = ts;
    } catch (e) {
      console.error("queueSavePartial upsert error", e);
    }
  }, 300);
}

// 3) 실시간 구독(updated_at 가드)
export function subscribeUserState(userId, onChange) {
  const onlyIfNewer = (row) => {
    if (!row) return;
    const ts = row.updated_at ? Date.parse(row.updated_at) : 0;
    if (!ts) return;
    if (lastAppliedAt && ts <= lastAppliedAt) return;
    lastAppliedAt = ts;
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
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}
