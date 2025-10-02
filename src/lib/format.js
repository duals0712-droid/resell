// src/lib/format.js

/** 숫자를 가격 형식으로 변환 (예: 2500 -> "2,500") */
export function fmtNumber(n) {
  return (Number(n) || 0).toLocaleString();
}

/** 숫자를 가격 + 원 표시 (예: 2500 -> "2,500원") */
export function fmtCost(n) {
  return fmtNumber(n) + "원";
}

/** 날짜 YYYY-MM-DD */
export function fmtDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10);
}

/** 날짜/시간 YYYY-MM-DD HH:mm */
export function fmtDateTime(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString();
}

// src/lib/format.js
export const fmt = (n = 0) => (Number(n) || 0).toLocaleString();

/** ISO/Date -> YYYY-MM-DD */
export const ymd = (d) => {
  try {
    const dd = new Date(d);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, "0");
    const day = String(dd.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
};