// src/lib/inventory.js

/** 현재 재고 수량(총합) */
export function availableQty(lots = [], productId, size) {
  if (!productId || !size) return 0;
  return lots
    .filter((l) => l.productId === productId && String(l.size) === String(size))
    .reduce((s, l) => s + (Number(l.qty) || 0), 0);
}

/** 내부: ISO → YYYY-MM-DD (로컬기준) */
function ymdLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** 내부: LOT 안정 정렬 비교함수
 *  1) receivedYmd(문자열)가 있으면 그것 기준 오름차순, 없으면 ymdLocal(receivedAt)
 *  2) receivedAt(ISO) 오름차순 (초/밀리초 포함)
 *  3) createdSeq 오름차순 (숫자, 없으면 +∞)
 *  4) createdAt(ISO) 오름차순
 *  5) 원본 인덱스 오름차순(완전한 안정성)
 */
function compareLotsStable(a, b, idxA = 0, idxB = 0) {
  const da = a.receivedYmd || ymdLocal(a.receivedAt);
  const db = b.receivedYmd || ymdLocal(b.receivedAt);
  if (da !== db) return da < db ? -1 : 1;

  const ra = Date.parse(a.receivedAt || 0) || 0;
  const rb = Date.parse(b.receivedAt || 0) || 0;
  if (ra !== rb) return ra - rb;

  const sa = Number(a.createdSeq ?? Number.POSITIVE_INFINITY);
  const sb = Number(b.createdSeq ?? Number.POSITIVE_INFINITY);
  if (sa !== sb) return sa - sb;

  const ca = Date.parse(a.createdAt || 0) || 0;
  const cb = Date.parse(b.createdAt || 0) || 0;
  if (ca !== cb) return ca - cb;

  return idxA - idxB;
}

/** FIFO 배분 (안정 정렬 후 오래된 LOT부터 소진) */
export function allocateFIFO(lots = [], productId, size, needQty) {
  const need = Number(needQty) || 0;
  if (!productId || !size || need <= 0) {
    return { allocations: [], nextLots: lots.slice(), error: true };
  }

  const target = [];
  const others = [];
  for (let i = 0; i < lots.length; i++) {
    const l = lots[i];
    if (l.productId === productId && String(l.size) === String(size)) {
      target.push({ ...l, __idx: i }); // 원본 인덱스 보관(완전 안정성)
    } else {
      others.push(l);
    }
  }

  // 안정 정렬
  target.sort((a, b) => compareLotsStable(a, b, a.__idx, b.__idx));

  let remain = need;
  const allocations = [];
  const nextTarget = [];

  for (const lot of target) {
    if (remain <= 0) {
      const { __idx, ...rest } = lot;
      nextTarget.push(rest);
      continue;
    }
    const have = Number(lot.qty) || 0;
    if (have <= 0) continue;

    const take = Math.min(have, remain);
    if (take > 0) {
      allocations.push({
        lotId: lot.id,
        qty: take,
        purchasePrice: Number(lot.purchasePrice) || 0,
      });
      const left = have - take;
      remain -= take;
      const { __idx, ...rest } = lot;
      if (left > 0) nextTarget.push({ ...rest, qty: left });
      // left === 0 → 완전 소진되어 제거
    }
  }

  if (remain > 0) {
    // 재고 부족 → 실패(원본 유지)
    return { allocations: [], nextLots: lots.slice(), error: true };
  }

  // 성공 → 남은 target + others
  const nextLots = [...others, ...nextTarget];
  return { allocations, nextLots, error: false };
}

/**
 * 재고 집계(우측 패널/실시간 재고용)
 * - 상품별 합계/평균
 * - 사이즈별 합계/평균
 * - lot(소분류) 정렬: compareLotsStable
 * - 사이즈 순서: 품목 관리에서 등록한 product.sizes 순서 고정
 */
export function computeAggregated(products = [], lots = []) {
  const byProduct = new Map();

  // lots를 product별/size별로 묶기
  for (let i = 0; i < lots.length; i++) {
    const l = lots[i];
    const pid = l.productId;
    if (!pid) continue;

    if (!byProduct.has(pid)) {
      const p = products.find((x) => x.id === pid) || {};
      byProduct.set(pid, {
        id: p.id || pid,
        code: p.code || "",
        name: p.name || "",
        image: p.image || "",
        brand: p.brand || "",
        category: p.category || "", // "대분류" 또는 "대분류 > 소분류"
        sizes: new Map(),
        sizeOrder: Array.isArray(p.sizes) ? p.sizes : [],
      });
    }

    const pEntry = byProduct.get(pid);
    const sz = String(l.size ?? "");
    if (!pEntry.sizes.has(sz)) {
      pEntry.sizes.set(sz, { size: sz, lots: [] });
    }
    pEntry.sizes.get(sz).lots.push({
      id: l.id,
      receivedYmd: l.receivedYmd,  // 표시용(문자열, 변환 없음)
      receivedAt: l.receivedAt,    // ISO(초/ms 포함, FIFO용)
      createdAt: l.createdAt,      // ISO
      createdSeq: l.createdSeq,    // 안정 정렬 보조
      qty: Number(l.qty) || 0,
      purchasePrice: Number(l.purchasePrice) || 0,
      __idx: i,                    // 완전한 안정성
    });
  }

  const result = [];
  for (const [, pEntry] of byProduct) {
    let productQty = 0;
    let productCost = 0;
    const sizeObj = {};

    // 품목에 등록된 사이즈 순서로 출력(없으면 실제 존재하는 순서)
    const orderedSizes = pEntry.sizeOrder.length
      ? pEntry.sizeOrder
      : Array.from(pEntry.sizes.keys());

    for (const sz of orderedSizes) {
      const sEntry = pEntry.sizes.get(sz) || { size: sz, lots: [] };

      // LOT 정렬 (FIFO 안정)
      sEntry.lots.sort((a, b) => compareLotsStable(a, b, a.__idx, b.__idx));

      const sQty = sEntry.lots.reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
      const sCost = sEntry.lots.reduce(
        (sum, x) => sum + (Number(x.qty) || 0) * (Number(x.purchasePrice) || 0),
        0
      );
      const sAvg = sQty > 0 ? sCost / sQty : 0;

      sizeObj[sz] = {
        size: sz,
        qty: sQty,
        avg: sAvg,
        lots: sEntry.lots.map(({ __idx, ...rest }) => ({
          ...rest,
          // UI 편의를 위한 표시용 날짜 (문자열 우선, 없으면 로컬 변환)
          displayDate: rest.receivedYmd || ymdLocal(rest.receivedAt),
        })),
      };

      productQty += sQty;
      productCost += sCost;
    }

    const pAvg = productQty > 0 ? productCost / productQty : 0;

    result.push({
      id: pEntry.id,
      code: pEntry.code,
      name: pEntry.name,
      image: pEntry.image,
      brand: pEntry.brand,
      category: pEntry.category,
      qty: productQty,
      avg: pAvg,
      sizes: sizeObj,
    });
  }

  // 상품코드 → 상품명 정렬
  result.sort((a, b) => {
    const c = (a.code || "").localeCompare(b.code || "");
    if (c) return c;
    return (a.name || "").localeCompare(b.name || "");
  });

  return result;
}
