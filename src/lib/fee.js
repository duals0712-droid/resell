// src/lib/fee.js

/**
 * 수수료 계산 유틸
 * @param {Object} partner - 거래처 객체
 * @param {number} salePrice - 판매가
 * @returns {number} fee (수수료 금액)
 */
export function calcFee(partner, salePrice) {
  if (!partner?.fee) return 0;
  const f = partner.fee;

  if (f.platform === 'online') {
    const pct = Number(f.onlinePercent || 0) / 100;
    const fee = salePrice * pct;
    return f.vatMode === 'separate' ? fee * 1.1 : fee;
  }

  if (f.platform === 'kream') {
    const pct = Number(f.kreamPercent || 0) / 100;
    const fixed = Number(f.kreamFixed || 0);
    const fee = salePrice * pct + fixed;
    return f.vatMode === 'separate' ? fee * 1.1 : fee;
  }

  if (f.platform === 'poison') {
    if (f.poisonCategory === 'goods') {
      if (salePrice >= 322000) return 45000;
      if (salePrice >= 129000) return salePrice * 0.14;
      return 18000;
    } else {
      if (salePrice >= 450000) return 45000;
      if (salePrice >= 150000) return salePrice * 0.10;
      return 15000;
    }
  }

  return 0;
}
