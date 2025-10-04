// src/pages/LedgerPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
/* ========================= 유틸 ========================= */
const fmt = (n = 0) => (Number(n) || 0).toLocaleString();
const onlyDigits = (s = "") => (s + "").replace(/[^\d]/g, "");
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
const todayYmd = () => ymdLocal(new Date().toISOString());

// 해당 월의 1일, 말일 (로컬 기준)
const monthRangeOf = (year, month) => {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return { from: ymdLocal(first.toISOString()), to: ymdLocal(last.toISOString()) };
};

// 결제수단/거래처 라벨
const paymentLabelOf = (pay) => {
  if (!pay) return "-";
  if (pay.type === "card") {
    const last4 = String(pay.cardNo || "").replace(/\D/g, "").slice(-4);
    return `${pay.cardName || "카드"} (${last4})`;
  }
  if (pay.type === "account") {
    const last4 = String(pay.acctNo || "").replace(/\D/g, "").slice(-4);
    return `${pay.acctBank || ""} ${pay.acctName || ""} (${last4})`;
  }
  return "-";
};
const partnerLabelOf = (p) => {
  if (!p) return "-";
  const biz = p.bizName || p.company || p.alias || "";
  return biz ? `${p.name}(${biz})` : p.name || "-";
};

// 날짜 반복
const eachDay = (from, to) => {
  const out = [];
  let d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    out.push(ymdLocal(d.toISOString()));
    d.setDate(d.getDate() + 1);
  }
  return out;
};

/* ========================= 토스트 ========================= */
function Toast({ open, type = "success", message = "" }) {
  const color =
    type === "success" ? "bg-emerald-600" : type === "warning" ? "bg-amber-500" : "bg-rose-600";
  return (
    <div
      className={[
        "fixed left-1/2 -translate-x-1/2 z-[200] rounded-xl shadow-lg text-white px-4 py-2",
        color,
        "transition-all duration-300 ease-out",
        open ? "top-4 opacity-100 translate-y-0" : "-top-10 opacity-0 -translate-y-4",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

/* ========================= 작은 툴팁 아이콘 ========================= */
function Hint({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block align-middle ml-1 text-gray-400 cursor-default select-none"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      aria-label={text}
    >
      <span className="text-[13px] leading-none">⚠︎</span>
      {open && (
        <span
          className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 text-xs bg-black/75 text-white px-2 py-1 rounded whitespace-pre-line text-left break-keep max-w-[320px]"
          style={{ pointerEvents: "none" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

/* ========================= 수입/지출 직접입력 모달 ========================= */
const MANUAL_KEY = "res_book_manual_v1"; // 수기 장부 저장용

function ManualModal({ open, onClose, onSaved, partners, payments }) {
  const [kind, setKind] = useState("expense"); // 'expense' | 'income'
  const [date, setDate] = useState(todayYmd());
  const [title, setTitle] = useState("");
  const [partner, setPartner] = useState(""); // 자유 텍스트
  const [payId, setPayId] = useState("");
  const [taxIssued, setTaxIssued] = useState(false);
  const [totalStr, setTotalStr] = useState(""); // 콤마 포함 입력
  const [memo, setMemo] = useState("");

  const cards = (payments || []).filter((p) => p.type === "card");
  const accts = (payments || []).filter((p) => p.type === "account");

  const total = useMemo(() => Number(onlyDigits(totalStr) || 0), [totalStr]);
  const supply = useMemo(() => (taxIssued ? Math.floor(total / 1.1) : total), [total, taxIssued]);
  const vat = useMemo(() => (taxIssued ? total - supply : 0), [total, supply, taxIssued]);

  // 수입 선택 시 결제수단 자동 초기화 + 숨김
  useEffect(() => {
    if (kind === "income" && payId) setPayId("");
  }, [kind]); // eslint-disable-line

  const clearAll = () => {
    setKind("expense");
    setDate(todayYmd());
    setTitle("");
    setPartner("");
    setPayId("");
    setTaxIssued(false);
    setTotalStr("");
    setMemo("");
  };

  const saveManual = () => {
    if (!date) return alert("거래일자를 입력하세요.");
    if (!title.trim()) return alert("항목/내역을 입력하세요.");
    if (!total) return alert("합계금액을 입력하세요.");

    const row = {
      id: Math.random().toString(36).slice(2),
      kind, // 'expense'|'income'
      date, // YYYY-MM-DD
      title: title.trim(),
      partner: partner.trim(),
      paymentId: kind === "income" ? null : payId || null, // 수입이면 결제수단 저장 안함
      taxIssued: !!taxIssued,
      supply,
      vat,
      total,
      memo: memo.trim(),
      createdAt: new Date().toISOString(),
    };

    const arr = load(MANUAL_KEY, []);
    const next = [...arr, row];
    save(MANUAL_KEY, next);

    onSaved?.(row);
    clearAll();
    onClose?.();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[180]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-bold">수입/지출 직접 입력</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-6 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-600 mb-1">구분</div>
                <select
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="expense">지출</option>
                  <option value="income">수입</option>
                </select>
              </div>
              <div>
                <div className="text-gray-600 mb-1">거래일자</div>
                <input
                  type="date"
                  className="w-full border rounded-xl px-3 py-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="text-gray-600 mb-1">항목/내역</div>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="예: 식대, 사무용품 구매"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <div className="text-gray-600 mb-1">거래처 (선택)</div>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="예: 거래한 상호명"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
              />
            </div>

            {/* 지출일 때만 결제수단 노출 */}
            {kind !== "income" && (
              <div>
                <div className="text-gray-600 mb-1">결제수단 (선택)</div>
                <select
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  value={payId || ""}
                  onChange={(e) => setPayId(e.target.value || "")}
                >
                  <option value="">결제수단 선택</option>
                  <option value="" disabled>──────── 카드 ────────</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.cardName} ({String(c.cardNo || "").replace(/\D/g, "").slice(-4)})
                    </option>
                  ))}
                  <option value="" disabled>──────── 계좌 ────────</option>
                  {accts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.acctBank} - {a.acctName} ({String(a.acctNo || "").replace(/\D/g, "").slice(-4)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="taxIssued"
                type="checkbox"
                checked={taxIssued}
                onChange={(e) => setTaxIssued(e.target.checked)}
              />
              {/* 'ㅁ' 제거 */}
              <label htmlFor="taxIssued" className="select-none">세금계산서/현금영수증 발행 여부</label>
            </div>

            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <div className="text-gray-600 mb-1">합계금액</div>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-right"
                  placeholder="0"
                  inputMode="numeric"
                  value={totalStr}
                  onChange={(e) => {
                    const s = onlyDigits(e.target.value);
                    setTotalStr(s ? Number(s).toLocaleString() : "");
                  }}
                />
              </div>
              <div>
                <div className="text-gray-600 mb-1">공급가액</div>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-right bg-gray-50"
                  value={fmt(supply)}
                  disabled
                />
              </div>
              <div>
                <div className="text-gray-600 mb-1">부가세액</div>
                <input
                  className="w-full border rounded-xl px-3 py-2 text-right bg-gray-50"
                  value={fmt(vat)}
                  disabled
                />
              </div>
            </div>

            <div>
              <div className="text-gray-600 mb-1">메모 (선택)</div>
              <textarea
                className="w-full border rounded-xl px-3 py-2 min-h-[96px]"
                placeholder="상세 메모를 입력하세요"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">취소</button>
            <button onClick={saveManual} className="px-4 py-2 rounded-xl bg-emerald-600 text-white">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}
/* ========================= 메인 페이지 ========================= */
export default function LedgerPage({
  products: productsProp,
  partners: partnersProp,
  payments: paymentsProp,
  lots: lotsProp,
  sales: salesProp,
  ioRec: ioRecProp, // 장부 표시 보조 용도(영구 로그)
}) {
  // 원천 데이터
  const products = productsProp ?? [];
  const partners = partnersProp ?? [];
  const payments = paymentsProp ?? [];
  const lots = lotsProp ?? []; // (참조만; 매입행 생성에는 더이상 사용 X)
  const sales = salesProp ?? [];
  const ioRec = ioRecProp ?? []; // ✅ 입고/출고/반품/교환 영구 로그

  // 토스트
  const [toast, setToast] = useState({ open: false, type: "success", message: "" });
  const toastRef = useRef(null);
  const showToast = (type, message, ms = 1800) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ open: true, type, message });
    toastRef.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), ms);
  };
  useEffect(() => () => toastRef.current && clearTimeout(toastRef.current), []);

  // 수기 데이터
  const [manual, setManual] = useState(load(MANUAL_KEY, []));
  const refreshManual = () => setManual(load(MANUAL_KEY, []));

  // 기본 월(진입 시점)
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const baseRange = monthRangeOf(year, month);
  const [from, setFrom] = useState(baseRange.from);
  const [to, setTo] = useState(baseRange.to);

  useEffect(() => {
    const r = monthRangeOf(year, month);
    setFrom(r.from);
    setTo(r.to);
  }, [year, month]);

  // 검색/필터
  const [query, setQuery] = useState("");
  const [partnerKind, setPartnerKind] = useState(""); // '' | 'buy' | 'sell'
  const [partnerSel, setPartnerSel] = useState("");
  const [payKind, setPayKind] = useState(""); // '' | 'card' | 'account'
  const [paySel, setPaySel] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState(""); // ''|'issued'|'not'
  const [modalOpen, setModalOpen] = useState(false);

  const partnerList = useMemo(() => {
    if (!partnerKind) return [];
    return partners.filter((p) => p.kind === (partnerKind === "buy" ? "buy" : "sell"));
  }, [partners, partnerKind]);
  const paymentList = useMemo(() => {
    if (!payKind) return [];
    return payments.filter((p) => p.type === payKind);
  }, [payments, payKind]);

  /* ====== 수수료 계산 (매출처별 & VAT 별도면 ×1.1) ====== */
  function calcFeePerUnitByPartner(partner, saleUnit) {
    if (!partner?.fee) return 0;
    const f = partner.fee || {};
    if (f.platform === "online") {
      const pct = Number(f.onlinePercent || 0) / 100;
      const fee = saleUnit * pct;
      return f.vatMode === "separate" ? fee * 1.1 : fee;
    }
    if (f.platform === "kream") {
      const pct = Number(f.kreamPercent || 0) / 100;
      const fixed = Number(f.kreamFixed || 0);
      const fee = saleUnit * pct + fixed;
      return f.vatMode === "separate" ? fee * 1.1 : fee;
    }
    if (f.platform === "poison") {
      if (f.poisonCategory === "goods") {
        if (saleUnit >= 322000) return 45000;
        if (saleUnit >= 129000) return saleUnit * 0.14;
        return 18000;
      } else {
        if (saleUnit >= 450000) return 45000;
        if (saleUnit >= 150000) return saleUnit * 0.1;
        return 15000;
      }
    }
    return 0;
  }

  /* ====== 매출 ====== */
  const saleRowsAll = useMemo(() => {
    return (sales || [])
      .filter((s) => (s.mode || "") !== "우선출고") // 우선출고 제외(후정산은 포함)
      .map((s) => {
        const qty = Number(s.qty || 1);
        const saleUnit = Number(s.salePrice || s.unitPrice || 0);
        const partner = partners.find((p) => p.id === s.partnerId);
        const product = products.find((p) => p.id === s.productId);

        // fee: 저장돼 있으면 사용, 없으면 계산
        const feeUnit = Number.isFinite(Number(s.fee))
          ? (Number(s.fee) / qty) || 0
          : calcFeePerUnitByPartner(partner, saleUnit);
        const fee = Math.round(feeUnit * qty);

        const isTaxFree = partner?.taxType === "taxfree";
        const totalSale = saleUnit * qty;
        const supply = isTaxFree ? totalSale : Math.floor(totalSale / 1.1);
        const vat = isTaxFree ? 0 : totalSale - supply;

        // 구매원가 총합(매출행에 연결된 원가)
        const purchaseTotal =
          (s.allocations || []).reduce(
            (sum, a) => sum + Number(a.qty || 0) * Number(a.purchasePrice || 0),
            0
          ) || Number(s.totalCost || 0);

        return {
          kind: "매출",
          iso: s.date || s.createdAt || s.soldAt || new Date().toISOString(),
          ymd: ymdLocal(s.date || s.createdAt || s.soldAt || new Date().toISOString()),
          partnerId: s.partnerId || "",
          paymentId: s.paymentId || "",
          name: s.name || product?.name || "-",
          code: s.code || product?.code || "-", // 품번 보장
          size: s.size || "",
          qty,
          totalSale,
          supply,
          vat,
          fee,
          settlement: totalSale - fee,
          purchaseTotal,
        };
      });
  }, [sales, partners, products]);

  /* ====== 매입(입고) — IOREC 기반 + 반품/교환(FIFO) 반영 ====== */
  const purchaseRowsAll = useMemo(() => {
    const inLogs = (ioRec || []).filter((r) => r.type === "입고");
    const returns = (ioRec || []).filter((r) => r.type === "반품");
    const exchanges = (ioRec || []).filter((r) => r.type === "교환");

    // 1) 기본 매입행
    const baseRows = inLogs.map((l) => {
      const product = products.find((x) => x.id === l.productId);
      const partner = partners.find((x) => x.id === l.partnerId);
      const pay = payments.find((x) => x.id === l.paymentId);

      const qtyIn = Number(l.qty || 0);
      const unit = Number(l.unitPurchase || 0);
      const ymd = ymdLocal(l.date || l.createdAt || new Date().toISOString());

      return {
        _id: l.id,
        kind: "매입",
        iso: l.date || l.createdAt || new Date().toISOString(),
        ymd,
        productId: l.productId,
        partnerId: l.partnerId || "",
        paymentId: l.paymentId || "",
        partnerLabel: partnerLabelOf(partner),
        name: product?.name || l.name || "-",
        code: product?.code || l.code || "-",
        size: l.size || "",
        unit,
        qty: qtyIn,
        taxfree: partner?.taxType === "taxfree",
        paymentLabel: paymentLabelOf(pay),
        invoice: partner?.taxType === "taxfree" ? "N" : "Y",
        _ret: 0,
        _moveOut: 0,
        _virtual: false,
      };
    });

    // FIFO 정렬
    const byFifo = (a, b) => {
      if (a.ymd !== b.ymd) return a.ymd < b.ymd ? -1 : 1;
      return (a.iso || "").localeCompare(b.iso || "");
    };
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

    // 3) 교환(from→to, 원 매입일 승계)
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
          _virtual: true,
        });

        need -= move;
        if (need <= 0) break;
      }
    }

    // 4) 최종 변환
    const finalizeRow = (row) => {
      const effQty = Math.max(0, Number(row.qty || 0) - Number(row._ret || 0) - Number(row._moveOut || 0));
      if (effQty <= 0) return null;

      const total = row.unit * effQty;
      const supply = row.taxfree ? total : Math.floor(total / 1.1);
      const vat = row.taxfree ? 0 : total - supply;

      return {
        kind: "매입",
        ymd: row.ymd,
        iso: row.iso,
        productId: row.productId,
        partnerId: row.partnerId || "",
        paymentId: row.paymentId || "",
        partnerLabel: row.partnerLabel || "-",
        name: row.name || "-",
        code: row.code || "-",
        size: row.size || "",
        qty: effQty,
        totalPurchase: total,
        supply,
        vat,
        fee: 0,
        settlement: 0,
        paymentLabel: row.paymentLabel || "-",
        invoice: row.invoice || "Y",
      };
    };

    const finalized = work
      .map(finalizeRow)
      .filter(Boolean)
      .sort((a, b) => (a.ymd === b.ymd ? (a.iso || "").localeCompare(b.iso || "") : a.ymd < b.ymd ? -1 : 1));

    return finalized;
  }, [ioRec, products, partners, payments]);

  /* ====== 수기 입력 ====== */
  const manualRowsAll = useMemo(
    () =>
      (manual || []).map((m) => ({
        kind: m.kind === "income" ? "매출" : "매입",
        ymd: m.date,
        iso: new Date(m.date + "T00:00:00").toISOString(),
        partnerLabel: m.partner || "-",
        name: m.title,
        code: "",
        size: "",
        qty: 1,
        paymentId: m.paymentId || "",
        invoice: m.taxIssued ? "Y" : "N",
        supply: Number(m.supply || 0),
        vat: Number(m.vat || 0),
        fee: 0,
        total: Number(m.total || 0),
        settlement: m.kind === "income" ? Number(m.total || 0) : 0,
        _manual: true,
      })),
    [manual]
  );

  // 기간 포함 여부
  const inRange = (ymd) => (!from || ymd >= from) && (!to || ymd <= to);

  /* ====== 장부 테이블용 통합 rows ====== */
  const ledgerRowsAll = useMemo(() => {
    // 매출행
    const saleRows = saleRowsAll
      .filter((r) => inRange(r.ymd))
      .map((r) => {
        const partner = partners.find((x) => x.id === r.partnerId);
        const pay = payments.find((x) => x.id === r.paymentId);
        return {
          kind: "매출",
          ymd: r.ymd,
          partnerId: r.partnerId || "",
          paymentId: r.paymentId || "",
          partnerLabel: partnerLabelOf(partner),
          name: r.name || "-",
          code: r.code || "-",
          size: r.size || "",
          qty: Number(r.qty || 1),
          paymentLabel: paymentLabelOf(pay),
          invoice: partner?.taxType === "taxfree" ? "N" : "Y",
          supply: r.supply,
          vat: r.vat,
          fee: r.fee,
          total: r.totalSale,
          settlement: r.settlement,
        };
      });

    // 매입행(표시 단계에서 음수화)
    const purchaseRows = purchaseRowsAll
      .filter((r) => inRange(r.ymd))
      .map((r) => ({
        kind: "매입",
        ymd: r.ymd,
        partnerId: r.partnerId || "",
        paymentId: r.paymentId || "",
        partnerLabel: r.partnerLabel || "-",
        name: r.name || "-",
        code: r.code || "-",
        size: r.size || "",
        qty: Number(r.qty || 1),
        paymentLabel: r.paymentLabel || "-",
        invoice: r.invoice || "Y",
        total: -Math.abs(Number(r.totalPurchase || 0)),
        supply: -Math.abs(Number(r.supply || 0)),
        vat: -Math.abs(Number(r.vat || 0)),
        fee: 0,
        settlement: 0,
      }));

    // 수기행
    const manualRows = manualRowsAll
      .filter((m) => inRange(m.ymd))
      .map((m) => ({
        kind: m.kind === "매출" ? "매출" : "매입",
        ymd: m.ymd,
        partnerId: "",
        paymentId: m.paymentId || "",
        partnerLabel: m.partnerLabel || "-",
        name: m.name,
        code: "",
        size: "",
        qty: 1,
        paymentLabel: paymentLabelOf(payments.find((x) => x.id === m.paymentId)),
        invoice: m.invoice,
        supply: m.kind === "매출" ? Number(m.supply || 0) : -Math.abs(Number(m.supply || 0)),
        vat: m.kind === "매출" ? Number(m.vat || 0) : -Math.abs(Number(m.vat || 0)),
        fee: 0,
        total: m.kind === "매출" ? Number(m.total || 0) : -Math.abs(Number(m.total || 0)),
        settlement: m.kind === "매출" ? Number(m.total || 0) : 0,
      }));

    // 병합
    let rows = [...saleRows, ...purchaseRows, ...manualRows];

    // 검색어
    const q = (query || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const hay = [r.name || "", r.code || "", r.partnerLabel || "", r.size || ""]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    // 필터
    if (partnerKind) rows = rows.filter((r) => (partnerKind === "buy" ? r.kind === "매입" : r.kind === "매출"));
    if (partnerSel) rows = rows.filter((r) => r.partnerId === partnerSel);
    if (payKind)
      rows = rows.filter((r) =>
        payKind === "card" ? /카드/.test(r.paymentLabel || "") : /계좌|현금|은행/.test(r.paymentLabel || "")
      );
    if (paySel) rows = rows.filter((r) => r.paymentId === paySel);
    if (invoiceFilter === "issued") rows = rows.filter((r) => r.invoice === "Y");
    if (invoiceFilter === "not") rows = rows.filter((r) => r.invoice === "N");

    // 🔄 정렬: 날짜 내림차순(최신 → 오래된)
    rows.sort((a, b) => (a.ymd === b.ymd ? 0 : a.ymd < b.ymd ? 1 : -1));

    return rows;
  }, [
    from,
    to,
    query,
    partnerKind,
    partnerSel,
    payKind,
    paySel,
    invoiceFilter,
    saleRowsAll,
    purchaseRowsAll,
    manualRowsAll,
    partners,
    payments,
  ]);

  /* ========================= 상단 카드 지표 ========================= */
  const saleRowsInPeriod = useMemo(
    () => saleRowsAll.filter((r) => r.ymd >= from && r.ymd <= to),
    [saleRowsAll, from, to]
  );
  const 상품매출총합 = saleRowsInPeriod.reduce((s, r) => s + Number(r.totalSale || 0), 0);
  const 수수료총합 = saleRowsInPeriod.reduce((s, r) => s + Number(r.fee || 0), 0);
  const 상품매입총합 = saleRowsInPeriod.reduce((s, r) => s + Number(r.purchaseTotal || 0), 0);
  const 총마진금 = 상품매출총합 - 상품매입총합 - 수수료총합;
  const 마진율 = 상품매출총합 > 0 ? Math.round((총마진금 / 상품매출총합) * 1000) / 10 : 0;

  // 현금흐름 (반품/교환 반영된 매입Rows 사용) + 수기 금액 반영
  const purchaseRowsInPeriod = useMemo(
    () => purchaseRowsAll.filter((r) => r.ymd >= from && r.ymd <= to),
    [purchaseRowsAll, from, to]
  );
  const 총매입금액_매입만 = purchaseRowsInPeriod.reduce(
    (s, r) => s + Math.abs(Number((r.totalPurchase || r.total) || 0)),
    0
  );

  const manualRowsInPeriod = manualRowsAll.filter((m) => m.ymd >= from && m.ymd <= to);
  const 수기수입 = manualRowsInPeriod
    .filter((m) => m.kind === "매출")
    .reduce((s, r) => s + Number(r.total || 0), 0);
  const 수기지출 = manualRowsInPeriod
    .filter((m) => m.kind === "매입")
    .reduce((s, r) => s + Math.abs(Number(r.total || 0)), 0);

  const 총정산금액_판매정산 = 상품매출총합 - 수수료총합;
  const 총정산금액 = 총정산금액_판매정산 + 수기수입; // 수기 수입 반영
  const 총매입금액 = 총매입금액_매입만 + 수기지출; // 수기 지출 반영
  const 총마진금액_현금흐름 = 총정산금액 - 총매입금액;

  /* ========================= 그래프 ========================= */
  const days = useMemo(() => eachDay(from, to), [from, to]);

  // 매출(총 매출 금액)
  const dailySales = useMemo(() => {
    const base = Object.fromEntries(days.map((d) => [d, 0]));
    saleRowsInPeriod.forEach((r) => (base[r.ymd] = (base[r.ymd] || 0) + Number(r.totalSale || 0)));
    return days.map((d) => base[d] || 0);
  }, [days, saleRowsInPeriod]);

  // 매입(총 매입 금액 = 매출행에 연결된 원가 합계)
  const dailyPurch = useMemo(() => {
    const base = Object.fromEntries(days.map((d) => [d, 0]));
    saleRowsInPeriod.forEach((r) => (base[r.ymd] = (base[r.ymd] || 0) + Number(r.purchaseTotal || 0)));
    return days.map((d) => base[d] || 0);
  }, [days, saleRowsInPeriod]);

  // 수수료
  const dailyFees = useMemo(() => {
    const base = Object.fromEntries(days.map((d) => [d, 0]));
    saleRowsInPeriod.forEach((r) => (base[r.ymd] = (base[r.ymd] || 0) + Number(r.fee || 0)));
    return days.map((d) => base[d] || 0);
  }, [days, saleRowsInPeriod]);

  // 마진(총 마진금 = 총매출 - 총매입 - 수수료)
  const dailyMargin = useMemo(
    () => days.map((_, i) => dailySales[i] - dailyPurch[i] - dailyFees[i]),
    [days, dailySales, dailyPurch, dailyFees]
  );

  const [showSales, setShowSales] = useState(true);
  const [showPurch, setShowPurch] = useState(true);
  const [showMargin, setShowMargin] = useState(true);

  // Y축 스케일
  const graphScale = useMemo(() => {
    const vals = [];
    if (showSales) vals.push(...dailySales);
    if (showPurch) vals.push(...dailyPurch);
    if (showMargin) vals.push(...dailyMargin);
    const maxVal = vals.length ? Math.max(...vals) : 0;

    if (maxVal <= 0) return { step: 10000, top: 50000 };

    const baseUnits = [
      1000, 2000, 5000,
      10000, 20000, 50000,
      100000, 200000, 500000,
      1000000, 2000000, 5000000,
      10000000, 20000000, 50000000,
    ];
    let step = baseUnits[baseUnits.length - 1];
    for (const u of baseUnits) {
      if (maxVal <= u * 5) { step = u; break; }
    }
    const top = step * 5;
    return { step, top };
  }, [dailySales, dailyPurch, dailyMargin, showSales, showPurch, showMargin]);

  // 그래프 좌표 유틸
  const svgWrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(0);
  useEffect(() => {
    if (!svgWrapRef.current || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setWrapW(e.contentRect.width);
    });
    obs.observe(svgWrapRef.current);
    return () => obs.disconnect();
  }, []);
  const PAD_L = 64, PAD_R = 16, PAD_T = 14, PAD_B = 40, STEP = 36, MIN_W = 960;
  const computedW = PAD_L + PAD_R + Math.max(0, days.length - 1) * STEP;
  const W = Math.max(wrapW || MIN_W, computedW);
  const H = 300;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (idx) => (days.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (plotW * idx) / (days.length - 1));
  const y = (val) => {
    const ratio = clamp(val / graphScale.top, 0, 1);
    return PAD_T + plotH * (1 - ratio);
  };

  const buildPath = (arr) => {
    if (!arr.length) return "";
    const segs = arr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`);
    return segs.join(" ");
  };
  const pathSales = useMemo(() => buildPath(dailySales), [dailySales, graphScale.top, W, H]);
  const pathPurch = useMemo(() => buildPath(dailyPurch), [dailyPurch, graphScale.top, W, H]);
  const pathMargin = useMemo(() => buildPath(dailyMargin), [dailyMargin, graphScale.top, W, H]);

  const [animTick, setAnimTick] = useState(0);
  useEffect(
    () => setAnimTick((n) => n + 1),
    [from, to, showSales, showPurch, showMargin, dailySales, dailyPurch, dailyMargin]
  );

  const [hoverIdx, setHoverIdx] = useState(null);
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < days.length; i++) {
      const dx = Math.abs(mx - x(i));
      if (dx < best) {
        best = dx;
        idx = i;
      }
    }
    setHoverIdx(idx);
  };
  const onLeave = () => setHoverIdx(null);

  /* ========================= 렌더 ========================= */
  return (
    <div className="space-y-6">
      <Toast open={toast.open} type={toast.type} message={toast.message} />

      {/* 최상단 제목 (카드 바깥) */}
      <h1 className="text-xl font-extrabold">통합 장부</h1>

      {/* 상단 : 연/월 + 기간 + 그래프 */}
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        {/* 연/월 + 기간 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select className="border rounded-xl px-3 py-2" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() + 1 - i).map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select className="border rounded-xl px-3 py-2" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <div className="text-sm text-gray-600">기간</div>
            <input type="date" className="border rounded-xl px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>~</span>
            <input type="date" className="border rounded-xl px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {/* 그래프 라벨/체크 */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold"></div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 select-none">
              <input type="checkbox" checked={showSales} onChange={(e) => setShowSales(e.target.checked)} />
              <span className="text-blue-600">매출</span>
            </label>
            <label className="flex items-center gap-2 select-none">
              <input type="checkbox" checked={showPurch} onChange={(e) => setShowPurch(e.target.checked)} />
              <span className="text-red-600">매입</span>
            </label>
            <label className="flex items-center gap-2 select-none">
              <input type="checkbox" checked={showMargin} onChange={(e) => setShowMargin(e.target.checked)} />
              <span className="text-emerald-600">마진</span>
            </label>
          </div>
        </div>

        {/* SVG */}
        <div className="overflow-x-auto relative" ref={svgWrapRef}>
          <svg width={W} height={H} onMouseMove={onMove} onMouseLeave={onLeave}>
            {/* Y 그리드/라벨 */}
            {Array.from({ length: 6 }, (_, i) => {
              const val = Math.round((graphScale.top / 5) * i);
              const yy = PAD_T + (H - PAD_T - PAD_B) * (1 - val / graphScale.top);
              return (
                <g key={i}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={yy} y2={yy} className="stroke-gray-200" />
                  <text x={PAD_L - 10} y={yy + 4} className="fill-gray-500 text-[10px]" textAnchor="end">
                    {fmt(val)}
                  </text>
                </g>
              );
            })}
            {/* X 라벨 */}
            {days.map((d, i) => (
              <text key={"xl" + i} x={x(i)} y={H - 8} className="fill-gray-500 text-[10px]" textAnchor="middle">
                {d.slice(5)}
              </text>
            ))}

            {/* 경로들 */}
            {showSales && <path d={pathSales} fill="none" stroke="#3b82f6" strokeWidth="2" key={`ps-${animTick}`} />}
            {showPurch && <path d={pathPurch} fill="none" stroke="#ef4444" strokeWidth="2" key={`pp-${animTick}`} />}
            {showMargin && <path d={pathMargin} fill="none" stroke="#10b981" strokeWidth="2" key={`pm-${animTick}`} />}

            {/* 점 */}
            {days.map((_, i) => (
              <g key={"pts" + i}>
                {showSales && <circle cx={x(i)} cy={y(dailySales[i])} r={3} className="fill-white" stroke="#3b82f6" />}
                {showPurch && <circle cx={x(i)} cy={y(dailyPurch[i])} r={3} className="fill-white" stroke="#ef4444" />}
                {showMargin && <circle cx={x(i)} cy={y(dailyMargin[i])} r={3} className="fill-white" stroke="#10b981" />}
              </g>
            ))}

            {/* 세로 가이드 */}
            {hoverIdx != null && <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD_T} y2={H - PAD_B} className="stroke-gray-300" />}
          </svg>

          {/* HTML 툴팁 */}
          {hoverIdx != null && (() => {
            const px = clamp(x(hoverIdx), PAD_L + 90, W - PAD_R - 90);
            const items = [];
            if (showSales) items.push({ label: "매출", value: fmt(dailySales[hoverIdx]), color: "#3b82f6" });
            if (showPurch) items.push({ label: "매입", value: fmt(dailyPurch[hoverIdx]), color: "#ef4444" });
            if (showMargin) items.push({ label: "마진", value: fmt(dailyMargin[hoverIdx]), color: "#10b981" });
            return (
              <div
                className="absolute bg-black/75 text-white text-[11px] rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap"
                style={{ left: px, top: 8, transform: "translateX(-50%)" }}
              >
                <div className="font-medium mb-1 text-center">{days[hoverIdx]}</div>
                <div className="flex gap-2">
                  {items.map((it) => (
                    <div key={it.label} className="flex gap-1 items-center">
                      <span style={{ color: it.color }}>{it.label}</span>
                      <span>{it.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 수익 및 마진 */}
      <div>
        <div className="text-lg font-bold mb-2">상품 마진</div>
        <div className="grid md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              총 매출 금액 <Hint text={"설정한 기간 동안의 판매한 상품의 총 판매가를 합한 금액입니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-blue-600">{fmt(상품매출총합)}원</div>
          </div>
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              총 수수료 금액 <Hint text={"설정한 기간 동안의 판매한 상품의 총 수수료 금액을 합한 금액입니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-purple-600">{fmt(수수료총합)}원</div>
          </div>
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              총 매입 금액 <Hint text={"설정한 기간 동안 판매된 상품에 대응하는 원가 합계(총 매입)입니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-red-600">{fmt(상품매입총합)}원</div>
          </div>
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              총 마진금 & 마진율{" "}
              <Hint text={"설정한 기간 동안의 판매한 상품\n'총 매출-총 수수료-총 매입'의 결과 금액입니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-green-600">
              {fmt(총마진금)}원 / {fmt(마진율)}%
            </div>
          </div>
        </div>
      </div>

      {/* 기간 손익 (한 칸 구성: 위 2개, 아래 3개) */}
      <div>
        <div className="text-lg font-bold mb-2">기간 손익 (현금흐름 파악)</div>

        {/* 위: 수기 금액 2칸 */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              수기 수입 금액 <Hint text={"사용자가 직접 추가한 수입 금액으로 실제 정산 금액에 반영됩니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-blue-600">{fmt(수기수입)}원</div>
          </div>
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              수기 지출 금액 <Hint text={"사용자가 직접 추가한 지출 금액으로 실제 매입 금액에 반영됩니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-red-600">{fmt(수기지출)}원</div>
          </div>
        </div>

        {/* 아래: 실제 3칸 */}
        <div className="grid md:grid-cols-3 gap-3 mt-3">
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              실제 정산 금액 <Hint text={"설정한 기간 동안 실제로 정산 받은 금액에 수기 수입 금액을 더한 값입니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-blue-600">{fmt(총정산금액)}원</div>
          </div>
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              실제 매입 금액 <Hint text={"설정한 기간 동안 매입한 금액에 수기 지출 금액을 더한 값입니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-red-600">{fmt(총매입금액)}원</div>
          </div>
          <div className="p-4 rounded-2xl border bg-white text-center">
            <div className="flex justify-center items-center gap-1 text-sm text-gray-500">
              실제 현금 자산 <Hint text={"설정한 기간 동안의 실제 내 자산 변화를 알려줍니다."} />
            </div>
            <div className="text-2xl font-extrabold mt-1 text-green-600">{fmt(총마진금액_현금흐름)}원</div>
          </div>
        </div>
      </div>

      {/* 검색/필터 + 버튼 (오른쪽 정렬) */}
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <div>
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="품번, 상품명, 사이즈로 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 거래처 */}
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600 w-14">거래처</div>
            <select
              className="border rounded-xl px-3 py-2"
              value={partnerKind}
              onChange={(e) => {
                setPartnerKind(e.target.value);
                setPartnerSel("");
              }}
            >
              <option value="">구분</option>
              <option value="buy">매입처</option>
              <option value="sell">매출처</option>
            </select>
            <select
              className="border rounded-xl px-3 py-2 w-44 disabled:text-gray-400"
              value={partnerSel}
              disabled={!partnerKind}
              onChange={(e) => setPartnerSel(e.target.value)}
            >
              <option value="">{partnerKind ? "전체 거래처" : "전체 거래처"}</option>
              {partnerList.map((p) => (
                <option key={p.id} value={p.id}>
                  {partnerLabelOf(p)}
                </option>
              ))}
            </select>
          </div>

          {/* 결제수단 */}
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600 w-14">결제수단</div>
            <select
              className="border rounded-xl px-3 py-2"
              value={payKind}
              onChange={(e) => {
                setPayKind(e.target.value);
                setPaySel("");
              }}
            >
              <option value="">구분</option>
              <option value="card">카드결제</option>
              <option value="account">현금결제</option>
            </select>
            <select
              className="border rounded-xl px-3 py-2 w-44 disabled:text-gray-400"
              value={paySel}
              disabled={!payKind}
              onChange={(e) => setPaySel(e.target.value)}
            >
              <option value="">{payKind ? "전체 수단" : "전체 수단"}</option>
              {paymentList.map((p) => (
                <option key={p.id} value={p.id}>
                  {paymentLabelOf(p)}
                </option>
              ))}
            </select>
          </div>

          {/* 계산서 */}
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600 w-14">계산서</div>
            <select
              className="border rounded-xl px-3 py-2 w-28"
              value={invoiceFilter}
              onChange={(e) => setInvoiceFilter(e.target.value)}
            >
              <option value="">전체</option>
              <option value="issued">발행</option>
              <option value="not">미발행</option>
            </select>
          </div>

          {/* 우측 버튼 */}
          <div className="ml-auto flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
              onClick={() => downloadCsv(ledgerRowsAll)}
            >
              엑셀 다운로드
            </button>
            <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white" onClick={() => setModalOpen(true)}>
              + 수입/지출 직접입력
            </button>
          </div>
        </div>
      </div>

      {/* 장부 테이블 */}
      <LedgerTable rows={ledgerRowsAll} />

      {/* 모달 */}
      <ManualModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          refreshManual();
          showToast("success", "수입/지출 내역을 저장했습니다.");
        }}
        partners={partners}
        payments={payments}
      />
    </div>
  );

  // CSV 다운로더 (현재 필터 반영) — 사이즈 컬럼 포함
  function downloadCsv(rowsForCsv) {
    const header = [
      "구분",
      "날짜",
      "거래처",
      "상품명/품번",
      "사이즈",
      "수량",
      "결제수단",
      "계산서",
      "합계금액",
      "공급가액",
      "부가세액",
      "수수료",
      "정산금액",
    ];
    const lines = [header.join(",")];
    rowsForCsv.forEach((r) => {
      const prod = `${(r.name || "").replace(/,/g, " ")} / ${(r.code || "").replace(/,/g, " ")}`;
      const row = [
        r.kind,
        r.ymd,
        (r.partnerLabel || "-").replace(/,/g, " "),
        prod,
        (r.size || "-").replace(/,/g, " "),
        r.qty,
        (r.paymentLabel || "-").replace(/,/g, " "),
        r.invoice,
        Number(r.total || 0),
        Number(r.supply || 0),
        Number(r.vat || 0),
        Number(r.fee || 0),
        Number(r.settlement || 0),
      ];
      lines.push(row.join(","));
    });
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/* ========================= 테이블 컴포넌트 ========================= */
function LedgerTable({ rows }) {
  // 페이징
  const [pageSize, setPageSize] = useState(10); // 10 | 50 | 100
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [pageSize, rows.length]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pagedRows = rows.slice(startIdx, startIdx + pageSize);

  // 합계(현재 페이지)
  const totals = useMemo(() => {
    const sum = (key) => pagedRows.reduce((s, r) => s + Number(r[key] || 0), 0);
    return {
      qty: pagedRows.reduce((s, r) => s + Number(r.qty || 0), 0),
      total: sum("total"),
      supply: sum("supply"),
      vat: sum("vat"),
      fee: sum("fee"),
      settlement: sum("settlement"),
    };
  }, [pagedRows]);

  // 금액 셀 (양수=초록, 음수=빨강)
  const Money = ({ v }) => {
    const n = Number(v || 0);
    const cls = n === 0 ? "" : n > 0 ? "text-emerald-700" : "text-rose-600";
    const sign = n < 0 ? "-" : "";
    return <span className={cls}>{sign}{fmt(Math.abs(n))}</span>;
  };

  return (
    <div className="w-full rounded-2xl border bg-white overflow-hidden">
      {/* 목록 박스 내부에만 가로/세로 스크롤 */}
      <div className="max-h-[480px] overflow-auto">
        {/* 자동 컬럼폭 + 모두 가운데 정렬 */}
        <table className="table-auto min-w-max w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="text-center">
              <th className="px-2 py-2">구분</th>
              <th className="px-2 py-2">날짜</th>
              <th className="px-2 py-2">거래처</th>
              <th className="px-2 py-2">상품명/품번</th>
              <th className="px-2 py-2">사이즈</th>
              <th className="px-2 py-2">수량</th>
              <th className="px-2 py-2">결제수단</th>
              <th className="px-2 py-2">계산서</th>
              <th className="px-2 py-2">합계금액</th>
              <th className="px-2 py-2">공급가액</th>
              <th className="px-2 py-2">부가세액</th>
              <th className="px-2 py-2">수수료</th>
              <th className="px-2 py-2">정산금액</th>
              <th className="px-2 py-2">관리</th>
            </tr>
          </thead>

          <tbody className="align-middle">
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-gray-500">
                  표시할 내역이 없습니다.
                </td>
              </tr>
            ) : (
              pagedRows.map((r, i) => (
                <tr key={i} className="border-t text-center">
                  {/* 구분 */}
                  <td className="px-2 py-2 whitespace-nowrap">{r.kind}</td>
                  {/* 날짜 */}
                  <td className="px-2 py-2 whitespace-nowrap">{r.ymd}</td>
                  {/* 거래처 */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-sm">{r.partnerLabel || "-"}</div>
                    <div className="text-[11px] text-gray-500">{r.kind === "매입" ? "매입처" : "매출처"}</div>
                  </td>
                  {/* 상품명/품번 */}
                  <td className="px-2 py-2">
                    <div className="text-sm whitespace-nowrap">{r.name || "-"}</div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">{r.code || "-"}</div>
                  </td>
                  {/* 사이즈 */}
                  <td className="px-2 py-2 whitespace-nowrap">{r.size || "-"}</td>
                  {/* 수량 */}
                  <td className="px-2 py-2 whitespace-nowrap">{fmt(r.qty)}</td>
                  {/* 결제수단 */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="text-sm">{r.paymentLabel || "-"}</div>
                  </td>
                  {/* 계산서 */}
                  <td className="px-2 py-2 whitespace-nowrap">{r.invoice}</td>
                  {/* 금액들 */}
                  <td className="px-2 py-2 whitespace-nowrap"><Money v={r.total} /></td>
                  <td className="px-2 py-2 whitespace-nowrap"><Money v={r.supply} /></td>
                  <td className="px-2 py-2 whitespace-nowrap"><Money v={r.vat} /></td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {Number(r.fee || 0) === 0 ? "0" : <span className="text-rose-600">-{fmt(Math.abs(Number(r.fee || 0)))}</span>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap"><Money v={r.settlement} /></td>
                  {/* 관리 */}
                  <td className="px-2 py-2 whitespace-nowrap">-</td>
                </tr>
              ))
            )}
          </tbody>

          {/* 합계 */}
          <tfoot className="sticky bottom-0 z-10 bg-gray-50">
            <tr className="font-semibold border-t text-center">
              <td className="px-2 py-2" colSpan={5}>총계(현재 페이지)</td>
              <td className="px-2 py-2">{fmt(totals.qty)}</td>
              <td className="px-2 py-2">-</td>
              <td className="px-2 py-2">-</td>
              <td className="px-2 py-2"><Money v={totals.total} /></td>
              <td className="px-2 py-2"><Money v={totals.supply} /></td>
              <td className="px-2 py-2"><Money v={totals.vat} /></td>
              <td className="px-2 py-2">
                {totals.fee === 0 ? "0" : <span className="text-rose-600">-{fmt(Math.abs(totals.fee))}</span>}
              </td>
              <td className="px-2 py-2"><Money v={totals.settlement} /></td>
              <td className="px-2 py-2">-</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 하단: 페이지네이션 & 표시개수 */}
      <div className="flex items-center justify-end gap-3 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">표시개수:</span>
          <select
            className="border rounded-xl px-2 py-1"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={10}>10개</option>
            <option value={50}>50개</option>
            <option value={100}>100개</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button className="px-2 py-1 rounded border" onClick={() => setPage(1)} disabled={page === 1}>≪</button>
          <button className="px-2 py-1 rounded border" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
          <span className="px-2 text-sm">{page} / {pageCount}</span>
          <button className="px-2 py-1 rounded border" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}>›</button>
          <button className="px-2 py-1 rounded border" onClick={() => setPage(pageCount)} disabled={page === pageCount}>≫</button>
        </div>
      </div>
    </div>
  );
}
