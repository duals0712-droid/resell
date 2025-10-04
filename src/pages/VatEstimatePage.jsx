// src/pages/VatEstimatePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
/* ===== 공통 유틸 ===== */
const fmt = (n = 0) => (Number(n) || 0).toLocaleString();
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// ISO → 로컬 YYYY-MM-DD
const ymdLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const MANUAL_KEY = "res_book_manual_v1";

/* ===== 페이지 컴포넌트 ===== */
export default function VatEstimatePage({
  products: productsProp,
  partners: partnersProp,
  payments: paymentsProp,
  lots: lotsProp,        // (참조만, 여기선 직접 사용 X)
  sales: salesProp,
  ioRec: ioRecProp,
}) {
  // 원천 데이터 (App에서 주는 값 우선, 없으면 로컬 로드)
  const products = productsProp ?? [];
  const partners = partnersProp ?? [];
  const payments = paymentsProp ?? [];
  const sales = salesProp ?? [];
  const ioRec = ioRecProp ?? [];
  const manual = load(MANUAL_KEY, []);

  // 연도/반기 기본값: 현재 날짜 기준
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisHalf = now.getMonth() + 1 <= 6 ? "H1" : "H2";

  const [year, setYear] = useState(thisYear);
  const [half, setHalf] = useState(thisHalf); // 'H1' | 'H2'

  const months = useMemo(
    () => (half === "H1" ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]),
    [half]
  );
  const monthLabels = months.map((m) => `${m}월`);

  /* ===== 매출 VAT 계산 ===== */
  const saleRows = useMemo(() => {
    // LedgerPage에서 계산한 로직을 간략화: 파트너 과세/면세 반영
    return (sales || []).map((s) => {
      const qty = Number(s.qty || 1);
      const saleUnit = Number(s.salePrice || s.unitPrice || 0);
      const partner = partners.find((p) => p.id === s.partnerId);
      const totalSale = saleUnit * qty;
      const isTaxFree = partner?.taxType === "taxfree";
      const supply = isTaxFree ? totalSale : Math.floor(totalSale / 1.1);
      const vat = isTaxFree ? 0 : totalSale - supply;
      const ymd = ymdLocal(s.date || s.createdAt || s.soldAt || new Date().toISOString());
      return { ymd, vat };
    });
  }, [sales, partners]);

  // 수기 매출 VAT
  const manualSaleRows = useMemo(
    () =>
      (manual || [])
        .filter((m) => m.kind === "income")
        .map((m) => ({
          ymd: m.date,
          vat: Number(m.vat || 0),
        })),
    [manual]
  );

  // 월별 매출 VAT 합계
  const salesVatByMonth = useMemo(() => {
    const acc = Object.fromEntries(months.map((m) => [m, 0]));
    const push = (row) => {
      if (!row?.ymd) return;
      const y = Number(row.ymd.slice(0, 4));
      const m = Number(row.ymd.slice(5, 7));
      if (y === Number(year) && months.includes(m)) acc[m] = (acc[m] || 0) + Number(row.vat || 0);
    };
    saleRows.forEach(push);
    manualSaleRows.forEach(push);
    return months.map((m) => acc[m] || 0);
  }, [saleRows, manualSaleRows, months, year]);

  /* ===== 매입 VAT 계산 (입고 + 반품/교환 FIFO 반영) ===== */
  const purchaseVatByMonth = useMemo(() => {
    const inLogs = (ioRec || []).filter((r) => r.type === "입고");
    const returns = (ioRec || []).filter((r) => r.type === "반품");
    const exchanges = (ioRec || []).filter((r) => r.type === "교환");

    // 1) 기본 매입행 생성
    const baseRows = inLogs.map((l) => {
      const product = products.find((x) => x.id === l.productId);
      const partner = partners.find((x) => x.id === l.partnerId);
      const qtyIn = Number(l.qty || 0);
      const unit = Number(l.unitPurchase || 0);
      const iso = l.date || l.createdAt || new Date().toISOString();
      const ymd = ymdLocal(iso);
      return {
        _id: l.id,
        iso,
        ymd,
        productId: l.productId,
        size: l.size || "",
        qty: qtyIn,
        unit,
        taxfree: partner?.taxType === "taxfree",
        _ret: 0,
        _moveOut: 0,
      };
    });

    // FIFO 정렬
    const byFifo = (a, b) => (a.ymd === b.ymd ? (a.iso || "").localeCompare(b.iso || "") : a.ymd < b.ymd ? -1 : 1);
    const work = [...baseRows].sort(byFifo);
    const findFifoRows = (productId, size) =>
      work.filter((r) => r.productId === productId && (r.size || "") === (size || "")).sort(byFifo);

    // 2) 반품 차감
    for (const ret of returns) {
      const productId = ret.productId;
      const size = ret.size || "";
      let need = Math.max(0, Number(ret.qty || 0));
      if (!need) continue;
      const fifoRows = findFifoRows(productId, size);
      for (const row of fifoRows) {
        const avail = Math.max(0, row.qty - row._ret - row._moveOut);
        if (avail <= 0) continue;
        const take = Math.min(avail, need);
        row._ret += take;
        need -= take;
        if (need <= 0) break;
      }
    }

    // 3) 교환 from→to (원 매입일 승계)
    const parseExchangeSize = (s) => {
      if (!s) return [null, null];
      const m = String(s).match(/(.+?)\s*[→\-]>\s*(.+)/);
      if (m) return [m[1].trim(), m[2].trim()];
      const parts = String(s).split("→");
      if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
      return [null, null];
    };
    for (const ex of exchanges) {
      const productId = ex.productId;
      const [fromSize, toSize] = parseExchangeSize(ex.size);
      let need = Math.max(0, Number(ex.qty || 0));
      if (!productId || !fromSize || !toSize || !need) continue;
      const fifoRows = findFifoRows(productId, fromSize);
      for (const row of fifoRows) {
        const avail = Math.max(0, row.qty - row._ret - row._moveOut);
        if (avail <= 0) continue;
        const move = Math.min(avail, need);
        row._moveOut += move;
        work.push({
          ...row,
          _id: `${row._id}_mv_${Math.random().toString(36).slice(2)}`,
          size: toSize,
          qty: move,
          _ret: 0,
          _moveOut: 0,
        });
        need -= move;
        if (need <= 0) break;
      }
    }

    // 4) 최종 VAT 합산(월별)
    const acc = Object.fromEntries(months.map((m) => [m, 0]));
    for (const row of work) {
      const effQty = Math.max(0, Number(row.qty || 0) - Number(row._ret || 0) - Number(row._moveOut || 0));
      if (effQty <= 0) continue;
      const total = row.unit * effQty;
      const supply = row.taxfree ? total : Math.floor(total / 1.1);
      const vat = row.taxfree ? 0 : total - supply;

      const y = Number(row.ymd.slice(0, 4));
      const m = Number(row.ymd.slice(5, 7));
      if (y === Number(year) && months.includes(m)) {
        acc[m] = (acc[m] || 0) + vat;
      }
    }

    // 수기 매입 VAT 더하기
    (manual || [])
      .filter((m) => m.kind === "expense")
      .forEach((m) => {
        if (!m?.date) return;
        const y = Number(m.date.slice(0, 4));
        const mm = Number(m.date.slice(5, 7));
        if (y === Number(year) && months.includes(mm)) acc[mm] = (acc[mm] || 0) + Number(m.vat || 0);
      });

    return months.map((m) => acc[m] || 0);
  }, [ioRec, products, partners, months, year, manual]);

  /* ===== 그래프 데이터 & 합계 ===== */
  const perMonthDiff = useMemo(
    () => salesVatByMonth.map((sv, i) => sv - (purchaseVatByMonth[i] || 0)),
    [salesVatByMonth, purchaseVatByMonth]
  );
  const totalDiff = useMemo(() => perMonthDiff.reduce((s, v) => s + v, 0), [perMonthDiff]);

  // 막대 높이 스케일 (6개월 전체 공통 스케일)
  const maxVal = Math.max(
    1,
    ...salesVatByMonth,
    ...purchaseVatByMonth
  );
  const MAX_BAR_H = 140; // px
  const h = (v) => (maxVal ? (v / maxVal) * MAX_BAR_H : 0);

  // 반응형 감지(폭) → 라벨/툴팁 위치 미세 조정용(선택)
  const gridRef = useRef(null);
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    if (!gridRef.current || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setWrapW(e.contentRect.width);
    });
    obs.observe(gridRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="space-y-6">
      {/* 제목 */}
      <h1 className="text-2xl md:text-3xl font-extrabold">부가세 신고 계산기</h1>

      {/* 컨트롤 패널 */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">연도</span>
            <select
              className="border rounded-xl px-3 py-2"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: 6 }, (_, i) => thisYear + 1 - i).map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">분기</span>
            <select
              className="border rounded-xl px-3 py-2"
              value={half}
              onChange={(e) => setHalf(e.target.value)}
            >
              <option value="H1">상반기(1월~6월)</option>
              <option value="H2">하반기(7월~12월)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 그래프 그리드 (3 x 2) */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="text-lg font-bold mb-3">월별 매출세액/매입세액</div>

        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {months.map((m, i) => {
            const saleVat = salesVatByMonth[i] || 0;
            const purchVat = purchaseVatByMonth[i] || 0;
            const diff = saleVat - purchVat;
            const monthLabel = monthLabels[i];

            return (
              <div key={m} className="border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{monthLabel}</div>
                </div>

                {/* 바 차트 (애니메이션) */}
                <div className="h-[180px] relative">
                  <div className="absolute inset-x-0 bottom-[28px] top-0 flex items-end justify-center gap-6">
                    {/* 매출세액 막대 */}
                    <div className="flex flex-col items-center">
                      <div
                        className="transition-all duration-500 ease-out"
                        style={{
                          height: `${h(saleVat)}px`,
                          width: "34px",
                          background: "#ff2828ff",
                          borderRadius: "8px 8px 0 0",
                        }}
                      />
                      {/* 값 라벨 */}
                      <div className="mt-1 text-[11px] text-gray-700 whitespace-nowrap">
                        <span className="text-rose-600 font-semibold">{fmt(saleVat)}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">매출세액</div>
                    </div>

                    {/* 매입세액 막대 */}
                    <div className="flex flex-col items-center">
                      <div
                        className="transition-all duration-500 ease-out"
                        style={{
                          height: `${h(purchVat)}px`,
                          width: "34px",
                          background: "#444aefff",
                          borderRadius: "8px 8px 0 0",
                        }}
                      />
                      {/* 값 라벨 */}
                      <div className="mt-1 text-[11px] text-gray-700 whitespace-nowrap">
                        <span className="text-blue-600 font-semibold">{fmt(purchVat)}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">매입세액</div>
                    </div>
                  </div>

                  {/* x축 */}
                  <div className="absolute left-2 right-2 bottom-[24px] h-px bg-gray-200" />
                </div>

                {/* 하단: 월별 (매출 - 매입) */}
                <div className="mt-2 text-center text-sm">
                  <span className="text-gray-600 mr-1">매출세액 - 매입세액 :</span>
                  <span className={diff >= 0 ? "text-rose-600 font-bold" : "text-blue-600 font-bold"}>
                    {diff >= 0 ? "+" : "-"}{fmt(Math.abs(diff))}원
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 최종 결과 */}
        <div className="mt-6 p-4 rounded-2xl bg-gray-50 text-center">
          {totalDiff >= 0 ? (
            <div className="text-xl md:text-2xl font-extrabold">
              당신이 납부해야 할 예상 부가세는{" "}
              <span className="text-rose-600 font-extrabold">{fmt(totalDiff)}원</span>{" "}
              입니다.
            </div>
          ) : (
            <div className="text-xl md:text-2xl font-extrabold">
              당신이 환급받을 예상 부가세는{" "}
              <span className="text-blue-600 font-extrabold">{fmt(Math.abs(totalDiff))}원</span>{" "}
              입니다.
            </div>
          )}
        </div>
<div className="mt-2 text-xs md:text-sm text-gray-600 leading-relaxed text-center">
  <div>※ 참고용 추정치입니다. 실제 신고액은 세무조정·면세·공제 한도 등에 따라 달라질 수 있습니다.</div>
  <div>
    매출세액 &gt; 매입세액 → <span className="text-rose-600 font-bold">납부</span>
  </div>
  <div>
    매출세액 &lt; 매입세액 → <span className="text-blue-600 font-bold">환급</span>
  </div>
  <div className="mt-1 underline underline-offset-2">
    예) 수출 거래(포이즌 등)은 매출세액이 <span className="text-rose-600 font-bold">0원</span>
    <span className="text-green-600">→ 따라서 매입세액이 많을 확률이 높아 환급에 유리</span>
  </div>
</div>

      </div>
    </div>
  );
}
