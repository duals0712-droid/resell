// src/lib/storage.js
// 서버 전용 모드: 남아 있는 로컬스토리지 의존을 모두 흡수하는 no-op 스텁

// 키 상수는 유지(페이지들이 참조하고 있을 수 있음)
export const LS = {
  PRODUCTS: "res_products_v1",
  LOTS: "res_lots_v1",
  SALES: "res_sales_v1",
  IOREC: "res_iorec_v1",
  PARTNERS: "res_partners_v1",
  PAYMENTS: "res_payments_v1",
  CATEGORIES: "res_categories_v1",
  BRANDS: "res_brands_v1",
  COURIERS: "res_couriers_v1",
};

// 네임스페이스 개념도 무시
export function setStorageNamespace() {
  /* no-op */
}
export function migrateLocalDataToNamespace() {
  /* no-op */
}

// 로컬 읽기: 항상 기본값 반환
export function load(_key, fallback) {
  return typeof fallback === "undefined" ? null : fallback;
}

// 로컬 쓰기: 아무 것도 안 함
export function save() {
  /* no-op */
}
