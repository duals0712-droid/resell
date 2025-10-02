// src/lib/storage.js
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

export function load(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("load error:", key, e);
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("save error:", key, e);
  }
}

export function uid() {
  return (
    Math.random().toString(36).slice(2) + "-" + Date.now().toString(36)
  );
}
