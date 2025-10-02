// src/pages/InOutRegister.jsx
import React from "react";
import { uid } from "../lib/uid.js";
import { LS, load, save } from "../lib/storage.js";
import { availableQty, allocateFIFO } from "../lib/inventory.js";

/* ========= 유틸 ========= */
const last4 = (s = "") => (s + "").replace(/\D/g, "").slice(-4);
const fmtNum = (n = 0) => (Number(n) || 0).toLocaleString();
const fmtWon = (n = 0) => fmtNum(n);
const onlyDigits = (s = "") => (s + "").replace(/\D/g, "");
const withCommas = (s = "") => {
  const d = onlyDigits(s);
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
};
const toNumber = (s = "") => Number(onlyDigits(s));
const todayYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const OUTLATER_KEY = "res_outlater_v1";

// 거래일(YYYY-MM-DD)에 현재 시/분/초/밀리초를 끼워 넣어 ISO로 만들기 (FIFO 정렬용)
function stampWithCurrentTime(ymd) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return new Date(`${ymd}T${hh}:${mm}:${ss}.${ms}`).toISOString();
}

/** ISO 시각에 ms만큼 가산해 유니크한 오름차순 타임스탬프를 만든다 */
function addMs(iso, ms) {
  const d = new Date(iso);
  d.setMilliseconds(d.getMilliseconds() + (Number(ms) || 0));
  return d.toISOString();
}

function nextLotSeq() {
  const KEY = "res_lot_seq_v1";
  const n = (Number(localStorage.getItem(KEY)) || 0) + 1;
  localStorage.setItem(KEY, String(n));
  return n;
}

/* ========= 미니 토스트 ========= */
function Toast({ open, kind = "info", message = "" }) {
  const bg =
    kind === "success"
      ? "bg-emerald-600"
      : kind === "error"
      ? "bg-rose-600"
      : "bg-gray-800";
  return (
    <div
      className={[
        "fixed left-1/2 z-[60] -translate-x-1/2 transition-all duration-300 ease-out",
        open ? "top-4 opacity-100 translate-y-0" : "top-2 opacity-0 -translate-y-3",
      ].join(" ")}
      aria-live="polite"
      role="status"
    >
      <div className={`${bg} text-white shadow-lg rounded-xl px-4 py-2`}>
        {message}
      </div>
    </div>
  );
}

/* ========= 드롭다운(카드/계좌) ========= */
function PaymentSelect({ payments, value, onChange }) {
  const cards = (payments || []).filter((p) => p.type === "card");
  const accts = (payments || []).filter((p) => p.type === "account");
  return (
    <select
      className="w-full border rounded-xl px-3 py-2 bg-white"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || "")}
    >
      <option value="">결제 수단 선택</option>
      <option value="" disabled>
        ──────── 카드 ────────
      </option>
      {cards.map((c) => (
        <option key={c.id} value={c.id}>
          {c.cardName} ({last4(c.cardNo)})
        </option>
      ))}
      <option value="" disabled>
        ──────── 계좌 ────────
      </option>
      {accts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.acctBank} - {a.acctName} ({last4(a.acctNo)})
        </option>
      ))}
      <option value="" disabled></option>
    </select>
  );
}

/* ========= 거래처(매입처/매출처) ========= */
function PartnerSelect({ partners, kind, value, onChange, placeholder }) {
  const list = (partners || []).filter((p) => p.kind === kind);
  return (
    <select
      className="w-full border rounded-xl px-3 py-2 bg-white"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || "")}
    >
      <option value="">{placeholder}</option>
      {list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.alias})
        </option>
      ))}
    </select>
  );
}

/* ========= 상품 자동완성 ========= */
function ProductPicker({ products, onPick }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef(null);
  const closeTimer = React.useRef(null);

  React.useEffect(() => {
    const onDocDown = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    let arr = [...products];
    if (t)
      arr = arr.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(t) ||
          (p.code || "").toLowerCase().includes(t)
      );
    return arr.slice(0, 100);
  }, [products, q]);

  const safeOpen = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };
  const safeClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  return (
    <div
      className="relative"
      ref={wrapRef}
      onMouseEnter={safeOpen}
      onMouseLeave={safeClose}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={safeOpen}
        placeholder="상품명 또는 품번으로 검색"
        className="w-full border rounded-xl px-3 py-2 bg-white"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 left-0 right-0 top-full -translate-y-px bg-white border max-h-72 overflow-auto shadow-lg rounded-xl">
          {filtered.length === 0 && (
            <div className="p-3 text-sm text-gray-500">검색결과 없음</div>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              className="p-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(p);
                setQ("");
                setOpen(false);
              }}
            >
              {p.image ? (
                <img
                  src={p.image}
                  className="w-10 h-10 rounded object-cover border"
                  alt=""
                />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-100" />
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {p.name}{" "}
                  <span className="text-gray-500 text-xs">({p.code})</span>
                </div>
                <div className="text-xs text-gray-500">
                  {[p.brand || "-", p.category || "-"].join(" / ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========= 사이즈 선택 모달 ========= */
function SizePickerModal({ mode, product, lots, onClose, onConfirm }) {
  const [checks, setChecks] = React.useState({});
  const toggleAll = (enabledSizes) => {
    const all = enabledSizes.every((s) => checks[s]);
    const next = {};
    enabledSizes.forEach((s) => (next[s] = !all));
    setChecks(next);
  };
  if (!product) return null;

  const sizes = product.sizes || [];
  const enabled = sizes.filter((sz) => {
    if (mode === "in") return true;
    const qty = availableQty(lots, product.id, sz);
    return qty > 0;
  });

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">사이즈 선택</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
          </div>
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" onChange={() => toggleAll(enabled)} />
              사이즈 전체 체크/해제
            </label>
            <div className="space-y-1">
              {sizes.map((sz) => {
                const avail = availableQty(lots, product.id, sz);
                const disabled = mode !== "in" && avail <= 0;
                return (
                  <label key={sz} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={!!checks[sz]}
                      onChange={() => setChecks((c) => ({ ...c, [sz]: !c[sz] }))}
                    />
                    <span className={disabled ? "text-red-600" : ""}>
                      {sz}
                      {mode !== "in" && ` (현재 수량: ${avail})`}
                      {disabled && " [불가]"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="p-4 border-t flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">취소</button>
            <button
              onClick={() => {
                const picked = Object.keys(checks).filter((k) => checks[k]);
                onConfirm(picked);
              }}
              className="px-4 py-2 rounded-xl bg-sky-500 text-white"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========= 택배비 드롭다운 ========= */
function CourierSelect({ couriers, onPick }) {
  const [val, setVal] = React.useState("");
  const handleChange = (e) => {
    const v = e.target.value;
    setVal(v);
    if (!v) return;
    try {
      const item = JSON.parse(v);
      onPick(item);
      setVal("");
    } catch {}
  };
  return (
    <select
      className="w-full border rounded-xl px-3 py-2 bg-white"
      value={val}
      onChange={handleChange}
    >
      <option value="">택배비 선택</option>
      {(couriers || []).map((c) => (
        <optgroup key={c.id} label={c.name}>
          {(c.tiers || []).map((t) => {
            const sizeName = t.sizeLabel || "규격";
            const label = `${sizeName}(${fmtWon(t.cost)}원)`;
            const payload = JSON.stringify({
              label: `${c.name}/${sizeName}`,
              cost: Number(t.cost) || 0,
            });
            return (
              <option key={t.id || `${c.id}-${sizeName}`} value={payload}>
                {label}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}

/* ========= 입출고 등록 메인 ========= */
export default function InOutRegister({
  products,
  lots,
  setLots,
  sales,
  setSales,
  ioRec,
  setIoRec,
  partners,
  payments,
  couriers,
}) {
  // 탭
  const [mode, setMode] = React.useState("in"); // 'in' | 'out' | 'out-later'
  // 거래일
  const [date, setDate] = React.useState(todayYmd());

  // 이미지 미리보기
  const [previewImage, setPreviewImage] = React.useState(null);

  // 토스트
  const [toast, setToast] = React.useState({ open: false, kind: "info", message: "" });
  const toastTimer = React.useRef(null);
  const showToast = (message, kind = "info", ms = 3000) => {
    setToast({ open: true, kind, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), ms);
  };
  React.useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // 전역 선택 (입고)
  const [buyPartnerId, setBuyPartnerId] = React.useState("");
  const [buyPaymentId, setBuyPaymentId] = React.useState("");

  // 전역 선택 (출고/우선출고 각각 별도 보유)
  const [sellPartnerIdOut, setSellPartnerIdOut] = React.useState("");
  const [sellPartnerIdLater, setSellPartnerIdLater] = React.useState("");

  // 행들(각 탭 별로 독립)
  const [inRows, setInRows] = React.useState([]); // 입고
  const [outRowsOut, setOutRowsOut] = React.useState([]); // 출고
  const [outRowsLater, setOutRowsLater] = React.useState([]); // 우선 출고(후정산)
  const [feeRowsOut, setFeeRowsOut] = React.useState([]); // 출고 택배비
  const [feeRowsLater, setFeeRowsLater] = React.useState([]); // 우선 출고 택배비

  // 사이즈 모달
  const [sizeModalProduct, setSizeModalProduct] = React.useState(null);

  const productById = (id) => products.find((p) => p.id === id);

  /* ====== 합계 (각 탭별로 개별 계산) ====== */
  const inTotalQty = inRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const inTotalPrice = inRows.reduce(
    (s, r) => s + (Number(r.qty) || 0) * toNumber(r.unitPrice),
    0
  );

  const outTotalQtyOut = outRowsOut.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const outTotalSalesOut = outRowsOut.reduce(
    (s, r) => s + (Number(r.qty) || 0) * toNumber(r.unitPrice),
    0
  );
  const courierTotalOut = feeRowsOut.reduce((s, f) => s + (Number(f.qty) || 0) * (Number(f.cost) || 0), 0);

  const outTotalQtyLater = outRowsLater.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const courierTotalLater = feeRowsLater.reduce((s, f) => s + (Number(f.qty) || 0) * (Number(f.cost) || 0), 0);

  // 수수료 로직
  const findPartner = (id) => partners.find((p) => p.id === id);
  function calcFeePerUnit(sellPartner, salePrice) {
    if (!sellPartner?.fee) return 0;
    const f = sellPartner.fee || {};
    if (f.platform === "online") {
      const pct = Number(f.onlinePercent || 0) / 100;
      const fee = salePrice * pct;
      return f.vatMode === "separate" ? fee * 1.1 : fee;
    }
    if (f.platform === "kream") {
      const pct = Number(f.kreamPercent || 0) / 100;
      const fixed = Number(f.kreamFixed || 0);
      const fee = salePrice * pct + fixed;
      return f.vatMode === "separate" ? fee * 1.1 : fee;
    }
    if (f.platform === "poison") {
      if (f.poisonCategory === "goods") {
        if (salePrice >= 322000) return 45000;
        if (salePrice >= 129000) return salePrice * 0.14;
        return 18000;
      } else {
        if (salePrice >= 450000) return 45000;
        if (salePrice >= 150000) return salePrice * 0.1;
        return 15000;
      }
    }
    return 0;
  }

  function expectedMarginForRow(row, forOutLater) {
    if (forOutLater) return 0; // 우선출고는 판매가 미정
    const prod = productById(row.productId);
    if (!prod) return 0;
    const qty = Number(row.qty) || 0;
    const sellPrice = toNumber(row.unitPrice);
    if (!qty || !sellPrice) return 0;
    const res = allocateFIFO(lots, row.productId, row.size, qty);
    if (res.error) return 0;
    const totalCost = res.allocations.reduce((s, a) => s + a.qty * a.purchasePrice, 0);
    const partner = findPartner(row.partnerId);
    const feePerUnit = calcFeePerUnit(partner, sellPrice);
    const totalFee = feePerUnit * qty;
    const revenue = sellPrice * qty;
    return revenue - totalFee - totalCost;
  }

  const outGoodsMarginOut = outRowsOut.reduce(
    (s, r) => s + expectedMarginForRow(r, false),
    0
  );
  const outTotalMarginOut = outGoodsMarginOut - courierTotalOut;

  const outGoodsMarginLater = 0;
  const outTotalMarginLater = outGoodsMarginLater - courierTotalLater;

  /* ====== 현재 모드용 참조 ====== */
  const isOut = mode === "out";
  const isOutLater = mode === "out-later";
  const activeOutRows = isOut ? outRowsOut : outRowsLater;
  const setActiveOutRows = isOut ? setOutRowsOut : setOutRowsLater;
  const activeFeeRows = isOut ? feeRowsOut : feeRowsLater;
  const setActiveFeeRows = isOut ? setFeeRowsOut : setFeeRowsLater;
  const activeSellPartner = isOut ? sellPartnerIdOut : sellPartnerIdLater;
  const setActiveSellPartner = isOut ? setSellPartnerIdOut : setSellPartnerIdLater;

  /* ====== 상품 선택 → 사이즈 모달 ====== */
  const onPickProduct = (p) => {
    if (mode === "in") {
      if (!buyPartnerId || !buyPaymentId) {
        showToast("매입처, 결제 수단을 먼저 선택하세요.", "error");
        return;
      }
    } else if (isOut || isOutLater) {
      if (!activeSellPartner) {
        showToast("매출처를 먼저 선택하세요.", "error");
        return;
      }
    }
    setSizeModalProduct(p);
  };

  /* ====== 사이즈 모달 확인 ====== */
  const confirmSizes = (sizes) => {
    if (!sizeModalProduct) return;
    const pid = sizeModalProduct.id;
    if (mode === "in") {
      const existKeys = new Set(inRows.map((r) => `${r.productId}|${r.size}`));
      const add = sizes
        .filter((sz) => !existKeys.has(`${pid}|${sz}`))
        .map((sz) => ({
          key: uid(),
          productId: pid,
          size: sz,
          partnerId: buyPartnerId,
          paymentId: buyPaymentId,
          qty: "",
          unitPrice: "", // 쉼표 포함 문자열로 보관
        }));
      if (add.length === 0) showToast("이미 추가된 사이즈입니다.", "error");
      setInRows((rows) => [...rows, ...add]);
    } else {
      const existKeys = new Set(activeOutRows.map((r) => `${r.productId}|${r.size}`));
      const add = sizes
        .filter((sz) => !existKeys.has(`${pid}|${sz}`))
        .map((sz) => ({
          key: uid(),
          productId: pid,
          size: sz,
          partnerId: activeSellPartner,
          qty: "",
          unitPrice: "", // 쉼표 포함 문자열로 보관
        }));
      if (add.length === 0) showToast("이미 추가된 사이즈입니다.", "error");
      setActiveOutRows((rows) => [...rows, ...add]);
    }
    setSizeModalProduct(null);
  };

  /* ====== 택배비 선택 ====== */
  const onPickCourierTier = (item) => {
    // qty 기본 1
    setActiveFeeRows((rs) => [...rs, { key: uid(), label: item.label, cost: item.cost, qty: 1 }]);
  };

  /* ====== 등록 완료 ====== */
  const onSubmit = () => {
    if (mode === "in") {
      if (!inRows.length) {
        showToast("입고할 상품을 추가해주세요.", "error");
        return;
      }
      for (const r of inRows) {
        if (!r.qty || !r.unitPrice) {
          showToast("수량/개당 매입가를 모두 입력하세요.", "error");
          return;
        }
      }
      let nextLots = [...lots];
      let nextIO = [...ioRec];

      const baseStamp = stampWithCurrentTime(date);

      inRows.forEach((r, idx) => {
        const stamp = addMs(baseStamp, idx); // 같은 제출 내에서 순서 고정
        const prod = productById(r.productId);

        const lot = {
          id: uid(),
          productId: r.productId,
          size: r.size,
          qty: Number(r.qty),
          purchasePrice: toNumber(r.unitPrice),
          receivedYmd: date,
          receivedAt: stamp,
          createdAt: stamp,
          createdSeq: nextLotSeq(),
          partnerId: r.partnerId,
          paymentId: r.paymentId,
        };
        nextLots.push(lot);

        // IOREC
        nextIO.push({
          id: uid(),
          type: "입고",
          date: stamp,
          productId: r.productId,
          code: prod?.code,
          name: prod?.name,
          size: r.size,
          qty: Number(r.qty),
          unitPurchase: toNumber(r.unitPrice),
          totalPurchase: Number(r.qty) * toNumber(r.unitPrice),
          memo: "",
          partnerId: r.partnerId,
          paymentId: r.paymentId,
        });
      });
      setLots(nextLots);
      save(LS.LOTS, nextLots);
      setIoRec(nextIO);
      save(LS.IOREC, nextIO);
      setInRows([]);
      showToast("입고 등록 완료", "success");
      return;
    }

    // 출고 / 우선출고
    if (!activeOutRows.length && !activeFeeRows.length) {
      showToast("출고할 상품을 추가해주세요.", "error");
      return;
    }
    for (const r of activeOutRows) {
      if (!r.qty) {
        showToast("수량을 입력하세요.", "error");
        return;
      }
      if (isOut && !r.unitPrice) {
        showToast("판매가를 입력하세요.", "error");
        return;
      }
      const avail = availableQty(lots, r.productId, r.size);
      if (Number(r.qty) > avail) {
        showToast("출고 수량이 재고보다 많습니다.", "error");
        return;
      }
    }

    let workingLots = [...lots];
    let newSales = [...sales];
    let newIO = [...ioRec];

    const baseStampOut = stampWithCurrentTime(date);

    if (isOut) {
      // 일반 출고
      activeOutRows.forEach((r, idx) => {
        const stamp = addMs(baseStampOut, idx);

        const qty = Number(r.qty);
        const unit = toNumber(r.unitPrice);
        const prod = productById(r.productId);

        const res = allocateFIFO(workingLots, r.productId, r.size, qty);
        if (res.error) return;

        const totalCost = res.allocations.reduce(
          (s, a) => s + a.qty * a.purchasePrice,
          0
        );
        const totalRevenue = qty * unit;

        newSales.push({
          id: uid(),
          productId: r.productId,
          size: r.size,
          qty,
          unitPrice: unit,
          salePrice: unit,
          date: stamp,
          allocations: res.allocations,
          totalCost,
          totalRevenue,
          partnerId: r.partnerId,
          mode: "출고",
          code: prod?.code,
          name: prod?.name,
        });

        res.allocations.forEach((a, j) => {
          const stamp2 = addMs(stamp, j);
          newIO.push({
            id: uid(),
            type: "출고",
            date: stamp2,
            productId: r.productId,
            code: prod?.code,
            name: prod?.name,
            size: r.size,
            qty: a.qty,
            unitPurchase: a.purchasePrice,
            totalPurchase: a.qty * a.purchasePrice,
            memo: "",
          });
        });

        workingLots = res.nextLots;
      });
    } else if (isOutLater) {
      // 우선출고: 재고만 차감 + 후정산 목록 저장
      const pending = load(OUTLATER_KEY, []);
      activeOutRows.forEach((r, idx) => {
        const stamp = addMs(baseStampOut, idx);

        const qty = Number(r.qty);
        const res = allocateFIFO(workingLots, r.productId, r.size, qty);
        if (res.error) return;

        const prod = productById(r.productId);

        // 장부 기록(출고 로그)
        res.allocations.forEach((a, j) => {
          const stamp2 = addMs(stamp, j);
          newIO.push({
            id: uid(),
            type: "출고",
            date: stamp2,
            productId: r.productId,
            code: prod?.code,
            name: prod?.name,
            size: r.size,
            qty: a.qty,
            unitPurchase: a.purchasePrice,
            totalPurchase: a.qty * a.purchasePrice,
            memo: "우선출고",
          });
        });
        workingLots = res.nextLots;

        // allocations → 1개 단위 unitCost로 펼치기
        const unitCosts = [];
        res.allocations.forEach((a) => {
          for (let i = 0; i < a.qty; i++) unitCosts.push(a.purchasePrice);
        });
        for (let i = 0; i < qty; i++) {
          const stamp3 = addMs(stamp, i);
          pending.push({
            id: uid(),
            date: stamp3,
            productId: r.productId,
            code: prod?.code,
            name: prod?.name,
            size: r.size,
            partnerId: r.partnerId,
            unitCost: Number(unitCosts[i] || 0),
            settlementPrice: null,
          });
        }
      });
      save(OUTLATER_KEY, pending);
    }

    setLots(workingLots);
    save(LS.LOTS, workingLots);
    setSales(newSales);
    save(LS.SALES, newSales);
    setIoRec(newIO);
    save(LS.IOREC, newIO);

    // 현재 모드의 목록만 비움
    setActiveOutRows([]);
    setActiveFeeRows([]);

    showToast(isOutLater ? "우선 출고 등록 완료" : "출고 등록 완료", "success");
  };

  /* ====== 렌더 ====== */
  // 그리드 템플릿 (이미지 컬럼 추가 / 운송장 삭제 반영)
  const gridColsIn = "grid grid-cols-[80px,1.6fr,0.8fr,1fr,1fr,0.8fr,1fr,1fr,0.6fr]";
  const gridColsOut = "grid grid-cols-[80px,1.6fr,0.8fr,1fr,0.8fr,1fr,1fr,0.6fr]";
  const gridColsOutLater = "grid grid-cols-[80px,1.6fr,0.8fr,1fr,0.8fr,1fr,0.6fr]";

  return (
    <div className="p-0 rounded-2xl bg-white shadow-sm relative">
      {/* 토스트 */}
      <Toast open={toast.open} kind={toast.kind} message={toast.message} />

      {/* 상단 제어 바 */}
      <div className="grid lg:grid-cols-[auto_1fr_auto] gap-3 p-4 border-b">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("in")}
            className={`px-3 py-2 rounded-xl border ${
              mode === "in" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
            }`}
          >
            입고
          </button>
          <button
            onClick={() => setMode("out")}
            className={`px-3 py-2 rounded-xl border ${
              mode === "out" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
            }`}
          >
            출고
          </button>
          <button
            onClick={() => setMode("out-later")}
            className={`px-3 py-2 rounded-xl border ${
              mode === "out-later" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
            }`}
          >
            우선 출고(후정산)
          </button>
        </div>
        <div></div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">거래일</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded-xl px-3 py-2"
          />
        </div>
      </div>

      {/* 표 + 우측 패널 */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-4 p-4">
        <div>
          {/* ===== 입고 테이블 ===== */}
          {mode === "in" && (
            <>
              <div className={`${gridColsIn} text-sm font-medium text-gray-600 border-b pb-2`}>
                <div>이미지</div>
                <div>제품번호/제품명</div>
                <div>사이즈</div>
                <div>매입처</div>
                <div>결제수단</div>
                <div>수량</div>
                <div>개당 매입가</div>
                <div>합계</div>
                <div className="text-right pr-2">삭제</div>
              </div>
              <div className="min-h-[300px]">
                {inRows.length === 0 && (
                  <div className="text-gray-400 text-sm py-10 text-center">
                    입고할 상품을 추가해주세요
                  </div>
                )}
                {inRows.map((r) => {
                  const prod = productById(r.productId);
                  const sum = (Number(r.qty) || 0) * toNumber(r.unitPrice);
                  const invalidQty = r.qty === "" || Number(r.qty) <= 0;
                  const invalidPrice = r.unitPrice === "" || toNumber(r.unitPrice) <= 0;
                  return (
                    <div key={r.key} className={`${gridColsIn} items-center border-b py-2 text-sm`}>
                      {/* 이미지 */}
                      <div className="py-1">
                        {prod?.image ? (
                          <img
                            src={prod.image}
                            className="w-12 h-12 rounded object-cover border cursor-zoom-in"
                            onClick={() => setPreviewImage(prod.image)}
                            title="이미지 크게 보기"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 grid place-items-center text-[10px] text-gray-400">
                            No
                          </div>
                        )}
                      </div>
                      {/* 제품정보 */}
                      <div>
                        <div className="font-medium">{prod?.code}</div>
                        <div className="text-xs text-gray-500">{prod?.name}</div>
                      </div>
                      <div className="font-medium">{r.size}</div>
                      <div>
                        <PartnerSelect
                          partners={partners}
                          kind="buy"
                          value={r.partnerId}
                          onChange={(v) =>
                            setInRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, partnerId: v } : x)))
                          }
                          placeholder="매입처"
                        />
                      </div>
                      <div>
                        <PaymentSelect
                          payments={payments}
                          value={r.paymentId}
                          onChange={(v) =>
                            setInRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, paymentId: v } : x)))
                          }
                        />
                      </div>
                      <div>
                        <input
                          className={`w-28 border rounded-xl px-3 py-2 ${invalidQty ? "border-rose-400 bg-rose-50" : ""}`}
                          value={r.qty}
                          onChange={(e) =>
                            setInRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, qty: e.target.value.replace(/[^\d]/g,"") } : x)))
                          }
                          placeholder="수량"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <input
                          className={`w-36 border rounded-xl px-3 py-2 ${invalidPrice ? "border-rose-400 bg-rose-50" : ""}`}
                          value={withCommas(r.unitPrice)}
                          onChange={(e) =>
                            setInRows((rows) =>
                              rows.map((x) => (x.key === r.key ? { ...x, unitPrice: withCommas(e.target.value) } : x))
                            )
                          }
                          placeholder="개당 매입가"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="font-bold">{`${fmtWon(sum)}원`}</div>
                      <div className="text-right pr-2">
                        <button
                          onClick={() => setInRows((rows) => rows.filter((x) => x.key !== r.key))}
                          className="text-red-600 font-bold"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t pt-3 text-sm flex items-center justify-between">
                <div className="font-semibold">총계</div>
                <div className="flex items-center gap-6 font-bold">
                  <div>
                    총 수량: <span>{`${fmtWon(inTotalQty)}개`}</span>
                  </div>
                  <div>
                    총 매입가: <span>{`${fmtWon(inTotalPrice)}원`}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== 출고 테이블 (운송장 제거 + 이미지 추가) ===== */}
          {isOut && (
            <>
              <div className={`${gridColsOut} text-sm font-medium text-gray-600 border-b pb-2`}>
                <div>이미지</div>
                <div>제품번호/제품명</div>
                <div>사이즈</div>
                <div>매출처</div>
                <div>수량</div>
                <div>판매가</div>
                <div>예상마진</div>
                <div className="text-right pr-2">삭제</div>
              </div>

              <div className="min-h-[300px]">
                {outRowsOut.length === 0 && feeRowsOut.length === 0 && (
                  <div className="text-gray-400 text-sm py-10 text-center">출고할 상품을 추가해주세요</div>
                )}

                {outRowsOut.map((r) => {
                  const prod = productById(r.productId);
                  const invalidQty =
                    r.qty === "" || Number(r.qty) <= 0 || Number(r.qty) > availableQty(lots, r.productId, r.size);
                  const margin = expectedMarginForRow(r, false);
                  return (
                    <div key={r.key} className={`${gridColsOut} items-center border-b py-2 text-sm`}>
                      {/* 이미지 */}
                      <div className="py-1">
                        {prod?.image ? (
                          <img
                            src={prod.image}
                            className="w-12 h-12 rounded object-cover border cursor-zoom-in"
                            onClick={() => setPreviewImage(prod.image)}
                            title="이미지 크게 보기"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 grid place-items-center text-[10px] text-gray-400">
                            No
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{prod?.code}</div>
                        <div className="text-xs text-gray-500">{prod?.name}</div>
                      </div>
                      <div className="font-medium">{r.size}</div>
                      <div>
                        <PartnerSelect
                          partners={partners}
                          kind="sell"
                          value={r.partnerId}
                          onChange={(v) =>
                            setOutRowsOut((rows) => rows.map((x) => (x.key === r.key ? { ...x, partnerId: v } : x)))
                          }
                          placeholder="매출처"
                        />
                      </div>
                      <div>
                        <input
                          className={`w-32 border rounded-xl px-3 py-2 ${invalidQty ? "border-rose-400 bg-rose-50" : ""}`}
                          value={r.qty ?? ""}
                          onChange={(e) =>
                            setOutRowsOut((rows) => rows.map((x) => (x.key === r.key ? { ...x, qty: e.target.value.replace(/[^\d]/g,"") } : x)))
                          }
                          placeholder={`현재 수량: ${availableQty(lots, r.productId, r.size)}`}
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <input
                          className={`w-36 border rounded-xl px-3 py-2 ${!r.unitPrice ? "border-rose-400 bg-rose-50" : ""}`}
                          value={withCommas(r.unitPrice)}
                          onChange={(e) =>
                            setOutRowsOut((rows) => rows.map((x) => (x.key === r.key ? { ...x, unitPrice: withCommas(e.target.value) } : x)))
                          }
                          placeholder="판매가"
                          inputMode="numeric"
                        />
                      </div>
                      <div className={`${margin < 0 ? "text-rose-600" : "text-emerald-700"} font-medium`}>{fmtWon(margin)}</div>
                      <div className="text-right pr-2">
                        <button
                          onClick={() => setOutRowsOut((rows) => rows.filter((x) => x.key !== r.key))}
                          className="text-red-600 font-bold"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 택배비 행 (수량 입력 가능) */}
                {feeRowsOut.map((f) => {
                  const total = (Number(f.qty) || 0) * (Number(f.cost) || 0);
                  return (
                    <div key={f.key} className={`${gridColsOut} items-center border-b py-2 text-sm`}>
                      <div>—</div>
                      <div className="text-gray-700">
                        <div className="font-medium">{f.label}</div>
                        <div className="text-xs text-gray-500">택배비</div>
                      </div>
                      <div>—</div>
                      <div>—</div>
                      <div>
                        <input
                          className="w-20 border rounded-xl px-3 py-2"
                          value={String(f.qty ?? 1)}
                          onChange={(e) =>
                            setFeeRowsOut((rs) => rs.map((x) => (x.key === f.key ? { ...x, qty: e.target.value.replace(/[^\d]/g,"") } : x)))
                          }
                          placeholder="수량"
                          inputMode="numeric"
                        />
                      </div>
                      <div>—</div>
                      <div className="text-rose-600 font-medium">-{fmtWon(total)}</div>
                      <div className="text-right pr-2">
                        <button onClick={() => setFeeRowsOut((rs) => rs.filter((x) => x.key !== f.key))} className="text-red-600 font-bold">
                          X
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t pt-3 text-sm flex items-center justify-between">
                <div className="font-semibold">총계</div>
                <div className="flex items-center gap-6">
                  <div>
                    총 수량: <span className="font-medium">{fmtWon(outTotalQtyOut)}</span>
                  </div>
                  <div>
                    총 판매가: <span className="font-medium">{fmtWon(outTotalSalesOut)}</span>
                  </div>
                  <div>
                    총 예상마진(택배비 포함):{" "}
                    <span className={`font-semibold ${outTotalMarginOut < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {fmtWon(outTotalMarginOut)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== 우선 출고(후정산) : 판매가 열 없음 / 이미지 추가 / 운송장 제거 ===== */}
          {isOutLater && (
            <>
              <div className={`${gridColsOutLater} text-sm font-medium text-gray-600 border-b pb-2`}>
                <div>이미지</div>
                <div>제품번호/제품명</div>
                <div>사이즈</div>
                <div>매출처</div>
                <div>수량</div>
                <div>예상마진</div>
                <div className="text-right pr-2">삭제</div>
              </div>

              <div className="min-h-[300px]">
                {outRowsLater.length === 0 && feeRowsLater.length === 0 && (
                  <div className="text-gray-400 text-sm py-10 text-center">출고할 상품을 추가해주세요</div>
                )}

                {outRowsLater.map((r) => {
                  const prod = productById(r.productId);
                  const invalidQty =
                    r.qty === "" || Number(r.qty) <= 0 || Number(r.qty) > availableQty(lots, r.productId, r.size);
                  const margin = 0; // 후정산은 마진 0 표시
                  return (
                    <div key={r.key} className={`${gridColsOutLater} items-center border-b py-2 text-sm`}>
                      {/* 이미지 */}
                      <div className="py-1">
                        {prod?.image ? (
                          <img
                            src={prod.image}
                            className="w-12 h-12 rounded object-cover border cursor-zoom-in"
                            onClick={() => setPreviewImage(prod.image)}
                            title="이미지 크게 보기"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 grid place-items-center text-[10px] text-gray-400">
                            No
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{prod?.code}</div>
                        <div className="text-xs text-gray-500">{prod?.name}</div>
                      </div>
                      <div className="font-medium">{r.size}</div>
                      <div>
                        <PartnerSelect
                          partners={partners}
                          kind="sell"
                          value={r.partnerId}
                          onChange={(v) =>
                            setOutRowsLater((rows) => rows.map((x) => (x.key === r.key ? { ...x, partnerId: v } : x)))
                          }
                          placeholder="매출처"
                        />
                      </div>
                      <div>
                        <input
                          className={`w-32 border rounded-xl px-3 py-2 ${invalidQty ? "border-rose-400 bg-rose-50" : ""}`}
                          value={r.qty ?? ""}
                          onChange={(e) =>
                            setOutRowsLater((rows) => rows.map((x) => (x.key === r.key ? { ...x, qty: e.target.value.replace(/[^\d]/g,"") } : x)))
                          }
                          placeholder={`현재 수량: ${availableQty(lots, r.productId, r.size)}`}
                          inputMode="numeric"
                        />
                      </div>
                      <div className={`${margin < 0 ? "text-rose-600" : "text-emerald-700"} font-medium`}>{fmtWon(margin)}</div>
                      <div className="text-right pr-2">
                        <button
                          onClick={() => setOutRowsLater((rows) => rows.filter((x) => x.key !== r.key))}
                          className="text-red-600 font-bold"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 택배비 행 (수량 입력 가능) */}
                {feeRowsLater.map((f) => {
                  const total = (Number(f.qty) || 0) * (Number(f.cost) || 0);
                  return (
                    <div key={f.key} className={`${gridColsOutLater} items-center border-b py-2 text-sm`}>
                      <div>—</div>
                      <div className="text-gray-700">
                        <div className="font-medium">{f.label}</div>
                        <div className="text-xs text-gray-500">택배비</div>
                      </div>
                      <div>—</div>
                      <div>—</div>
                      <div>
                        <input
                          className="w-20 border rounded-xl px-3 py-2"
                          value={String(f.qty ?? 1)}
                          onChange={(e) =>
                            setFeeRowsLater((rs) => rs.map((x) => (x.key === f.key ? { ...x, qty: e.target.value.replace(/[^\d]/g,"") } : x)))
                          }
                          placeholder="수량"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="text-rose-600 font-medium">-{fmtWon(total)}</div>
                      <div className="text-right pr-2">
                        <button onClick={() => setFeeRowsLater((rs) => rs.filter((x) => x.key !== f.key))} className="text-red-600 font-bold">
                          X
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t pt-3 text-sm flex items-center justify-between">
                <div className="font-semibold">총계</div>
                <div className="flex items-center gap-6">
                  <div>
                    총 수량: <span className="font-medium">{fmtWon(outTotalQtyLater)}</span>
                  </div>
                  <div>
                    총 예상마진(택배비 포함):{" "}
                    <span className={`font-semibold ${outTotalMarginLater < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      {fmtWon(outTotalMarginLater)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ===== 우측 패널 (등록 버튼 제거 / 하단으로 이동) ===== */}
        <div className="rounded-xl border p-3 space-y-3">
          {mode === "in" && (
            <>
              <div className="font-semibold">매입처 추가</div>
              <PartnerSelect
                partners={partners}
                kind="buy"
                value={buyPartnerId}
                onChange={setBuyPartnerId}
                placeholder="매입처 선택"
              />
              <div className="font-semibold pt-2">결제 수단 추가</div>
              <PaymentSelect payments={payments} value={buyPaymentId} onChange={setBuyPaymentId} />
              <div className="font-semibold pt-2">상품 추가</div>
              <ProductPicker products={products} onPick={onPickProduct} />
            </>
          )}

          {isOut && (
            <>
              <div className="font-semibold">매출처 추가</div>
              <PartnerSelect
                partners={partners}
                kind="sell"
                value={sellPartnerIdOut}
                onChange={setSellPartnerIdOut}
                placeholder="매출처 선택"
              />
              <div className="font-semibold pt-2">상품 추가</div>
              <ProductPicker products={products} onPick={onPickProduct} />
              <div className="font-semibold pt-2">택배비용 추가</div>
              <CourierSelect couriers={couriers} onPick={onPickCourierTier} />
            </>
          )}

          {isOutLater && (
            <>
              <div className="font-semibold">매출처 추가</div>
              <PartnerSelect
                partners={partners}
                kind="sell"
                value={sellPartnerIdLater}
                onChange={setSellPartnerIdLater}
                placeholder="매출처 선택"
              />
              <div className="font-semibold pt-2">상품 추가</div>
              <ProductPicker products={products} onPick={onPickProduct} />
              <div className="font-semibold pt-2">택배비용 추가</div>
              <CourierSelect couriers={couriers} onPick={onPickCourierTier} />
            </>
          )}
        </div>
      </div>

      {/* 하단 오른쪽 고정 "등록 완료" 버튼 */}
      <div className="px-4 pb-4 flex justify-end">
        <button onClick={onSubmit} className="px-5 py-3 rounded-xl bg-indigo-600 text-white shadow">
          등록 완료
        </button>
      </div>

      {/* 이미지 큰 미리보기 모달 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="preview-large" className="max-h-[85vh] max-w-[85vw] rounded shadow-2xl" />
        </div>
      )}

      {/* 사이즈 선택 모달 */}
      {sizeModalProduct && (
        <SizePickerModal
          mode={mode === "in" ? "in" : "out"}
          product={sizeModalProduct}
          lots={lots}
          onClose={() => setSizeModalProduct(null)}
          onConfirm={confirmSizes}
        />
      )}
    </div>
  );
}
