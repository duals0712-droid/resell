// src/lib/uid.js
export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
