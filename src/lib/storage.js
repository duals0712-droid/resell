// src/lib/storage.js
// 서버 전용 모드: 로컬 저장소는 완전 비활성화(no-op)

export const LS = {
  PRODUCTS: "noop_products",
  LOTS: "noop_lots",
  SALES: "noop_sales",
  IOREC: "noop_iorec",
  PARTNERS: "noop_partners",
  PAYMENTS: "noop_payments",
  CATEGORIES: "noop_categories",
  BRANDS: "noop_brands",
  COURIERS: "noop_couriers",
};

export function load(_key, fallback) {
  return fallback; // 항상 기본값 반환
}
export function save() {
  // no-op
}
export function setStorageNamespace() {
  // no-op
}
export function migrateLocalDataToNamespace() {
  // no-op
}
