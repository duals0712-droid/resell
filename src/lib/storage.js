// src/lib/storage.js

/* =========================
   사용자별 네임스페이스(접두어) 지원
   - 기본(비로그인/게스트): 접두어 없음 → 기존과 동일 키 사용
   - 로그인 후: setStorageNamespace("user:<uid>") 같은 값으로 설정
   - load/save 는 항상 (접두어 + ":" + 키) 형태로 접근
   ========================= */

export const LS = {
  USERS: "res_users",
  PRODUCTS: "res_products",
  LOTS: "res_lots",
  SALES: "res_sales",
  IOREC: "res_iorec",
  PARTNERS: "res_partners",
  PAYMENTS: "res_payments",
  CATEGORIES: "res_categories",
  BRANDS: "res_brands",
  COURIERS: "res_couriers",
};

// 현재 네임스페이스(접두어). 기본은 "" (게스트/로컬 단일 사용자)
let _NAMESPACE = "";

/** 현재 네임스페이스 확인용(디버그/표시용) */
export function getStorageNamespace() {
  return _NAMESPACE;
}

/**
 * 네임스페이스(접두어) 설정
 * - 예: setStorageNamespace(`user:${user.id}`)
 * - 빈값 또는 null/undefined 주면 접두어 제거(게스트 모드)
 */
export function setStorageNamespace(ns) {
  _NAMESPACE = ns ? String(ns).trim() : "";
}

/** 내부적으로 실제 localStorage 키로 변환 */
function nsKey(key) {
  return _NAMESPACE ? `${_NAMESPACE}:${key}` : key;
}

/** localStorage 안전 접근(SSR 대비) */
function getLocalStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch (e) {
    // noop
  }
  // 브라우저가 아니면 메모리 대체(개발/테스트용)
  const mem = new Map();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
}

const LS_OBJ = getLocalStorage();

/** JSON 로드 (네임스페이스 적용) */
export function load(key, fallback = []) {
  try {
    const raw = LS_OBJ.getItem(nsKey(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("load error:", key, e);
    return fallback;
  }
}

/** JSON 저장 (네임스페이스 적용) */
export function save(key, value) {
  try {
    LS_OBJ.setItem(nsKey(key), JSON.stringify(value));
  } catch (e) {
    console.warn("save error:", key, e);
  }
}

/** 고유 ID (기존 유지) */
export function uid() {
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

/* =========================================
   선택사항: 기존(무접두어) 데이터 → 새 네임스페이스로 마이그레이션
   - 처음 로그인 시, 이전 로컬 데이터(게스트)를 본인 계정으로 복사하고 싶을 때 사용
   - 이미 대상에 데이터가 있으면 덮어쓰지 않음(기본)
   사용예)
     migrateLocalDataToNamespace(`user:${user.id}`);
   ========================================= */
export function migrateLocalDataToNamespace(
  targetNamespace,
  keys = Object.values(LS),
  { overwrite = false } = {}
) {
  if (!targetNamespace) return;
  const prevNs = _NAMESPACE;

  try {
    // 1) 원본: 접두어 없이 읽기
    _NAMESPACE = "";
    for (const key of keys) {
      const srcKey = nsKey(key); // = key (빈 접두어)
      const srcRaw = LS_OBJ.getItem(srcKey);
      if (!srcRaw) continue;

      // 2) 대상: targetNamespace로 쓰기
      _NAMESPACE = targetNamespace;
      const dstKey = nsKey(key);
      const already = LS_OBJ.getItem(dstKey);
      if (already && !overwrite) continue; // 덮어쓰기 방지

      LS_OBJ.setItem(dstKey, srcRaw);
      // 필요하면 원본 삭제 원할 때 아래 주석 해제
      // _NAMESPACE = "";
      // LS_OBJ.removeItem(srcKey);
    }
  } catch (e) {
    console.warn("migrateLocalDataToNamespace error:", e);
  } finally {
    // 원래대로 복귀
    _NAMESPACE = prevNs;
  }
}
