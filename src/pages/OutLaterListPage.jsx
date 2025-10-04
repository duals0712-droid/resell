// src/pages/OutLaterListPage.jsx
import React from "react";
import { uid } from "../lib/uid.js";

const fmt = (n) => (Number(n) || 0).toLocaleString();

// 숫자 유틸 (입력시 천단위 콤마)
const onlyDigits = (s = "") => (s + "").replace(/\D/g, "");
const withCommas = (s = "") => {
  const d = onlyDigits(s);
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
};
const toNumber = (s = "") => Number(onlyDigits(s));

/* ====== 상단 토스트 ====== */
function Toast({ open, type = "success", message = "" }) {
  const color =
    type === "success"
      ? "bg-emerald-600"
      : type === "warning"
      ? "bg-amber-500"
      : "bg-rose-600";

  return (
    <div
      className={[
        "fixed left-1/2 -translate-x-1/2 z-[100] rounded-xl shadow-lg text-white px-4 py-2",
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

export default function OutLaterListPage({ partners, sales, setSales, products, outLater, setOutLater }) {
  const items = outLater || [];
  const setItems = setOutLater;
  const [q, setQ] = React.useState("");
  // 제품 정보(브랜드/분류/이미지 표시용)
  // 큰 이미지 미리보기
  const [previewImage, setPreviewImage] = React.useState(null);

  // 토스트 상태
  const [toast, setToast] = React.useState({ open: false, type: "success", message: "" });
  const toastTimer = React.useRef(null);
  const showToast = (type, message, ms = 3000) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast({ open: true, type, message });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), ms);
  };

  const productById = (id) => products.find((p) => p.id === id);
  const brandOf = (id) => productById(id)?.brand || "-";
  const imageOf = (id) => productById(id)?.image || "";
  const categoryParts = (id) => {
    const cat = productById(id)?.category || "";
    const [major, minor] = String(cat).split(">").map((s) => (s || "").trim());
    return { major: major || "-", minor: minor || "" };
  };

  const partnerLabel = (id) => {
    const p = partners.find((x) => x.id === id);
    if (!p) return "-";
    const biz = p.bizName || p.company || p.alias || "";
    return biz ? `${p.name}(${biz})` : p.name;
  };

  function calcFeeFor(item, salePrice) {
    const partner = partners.find((p) => p.id === item.partnerId);
    if (!partner?.fee) return 0;
    const f = partner.fee;

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

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [...items];
    return items.filter((it) => {
      const hay = [(it.name || ""), (it.code || "")].join(" ").toLowerCase();
      return hay.includes(t);
    });
  }, [items, q]);

  const onChangePrice = (id, val) => {
    const cleaned = withCommas(val);
    setItems((arr) => {
      const next = arr.map((it) => (it.id === id ? { ...it, settlementPrice: cleaned } : it));
      return next;
    });
  };

  const onDelete = (id) => {
    setItems((arr) => {
      const next = arr.filter((it) => it.id !== id);
      return next;
    });
    showToast("success", "항목을 삭제했습니다.");
  };

  const onSettle = () => {
    const now = new Date().toISOString();
    const toSettle = items.filter((it) => toNumber(it.settlementPrice) > 0);
    if (!toSettle.length) {
      showToast("warning", "판매가가 입력된 항목이 없습니다.");
      return;
    }

    const newSales = [...sales];
    let next = [...items];

    toSettle.forEach((it) => {
      const salePrice = toNumber(it.settlementPrice || 0);
      const fee = calcFeeFor(it, salePrice);
      const unitCost = Number(it.unitCost || 0);

      // 안전장치: 코드/이름도 같이 기록 (상품 테이블 변경/삭제 대비)
      newSales.push({
        id: uid(),
        productId: it.productId,
        size: it.size,
        qty: 1,
        unitPrice: salePrice,
        salePrice,
        date: now,
        allocations: [], // 재고는 우선출고 때 이미 차감됨
        totalCost: unitCost,
        totalRevenue: salePrice,
        partnerId: it.partnerId,
        tracking: "",
        mode: "후정산",
        fee,
        code: it.code,
        name: it.name,
      });

      next = next.filter((x) => x.id !== it.id);
    });

    setItems(next);
    setSales(newSales);

    showToast("success", "정산이 완료되었습니다.");
  };

  // 공통 그리드(이미지 컬럼 추가: 총 10열)
  const GRID =
    "grid grid-cols-[80px,1.2fr,1.3fr,0.9fr,0.6fr,1.1fr,0.9fr,0.9fr,0.9fr,0.4fr]";

  return (
    <div className="space-y-3 relative">
      {/* 토스트 */}
      <Toast open={toast.open} type={toast.type} message={toast.message} />

      {/* 상단 검색 */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="상품명 또는 품번으로 검색"
        className="w-full border rounded-xl px-3 py-2 bg-white"
      />

      {/* 표 */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* 헤더: 이미지 컬럼 추가, 가운데 정렬 */}
        <div className={`${GRID} text-sm font-medium text-gray-600 border-b px-3 py-2 text-center`}>
          <div>이미지</div>
          <div>출고날짜</div>
          <div>제품번호/제품명</div>
          <div>브랜드 / 분류</div>
          <div>사이즈</div>
          <div>매출처</div>
          <div>판매가</div>
          <div>매입가(FIFO)</div>
          <div>예상마진</div>
          <div className="text-right pr-2">삭제</div>
        </div>

        {filtered.length === 0 && (
          <div className="py-6 text-center text-gray-500 text-sm">우선출고 리스트가 없습니다.</div>
        )}

        {filtered.map((it) => {
          const priceNum = toNumber(it.settlementPrice);
          const fee = calcFeeFor(it, priceNum);
          const unitCost = Number(it.unitCost || 0); // 우선출고 시점에 확정된 FIFO 단가
          const margin = priceNum - fee - unitCost;
          const { major, minor } = categoryParts(it.productId);
          const img = imageOf(it.productId);

          return (
            <div
              key={it.id}
              className={`${GRID} items-center border-t px-3 py-2 text-sm text-center`}
            >
              {/* 이미지 */}
              <div className="py-1">
                {img ? (
                  <img
                    src={img}
                    className="w-12 h-12 rounded object-cover border cursor-zoom-in"
                    onClick={() => setPreviewImage(img)}
                    title="이미지 크게 보기"
                    alt=""
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-100 grid place-items-center text-[10px] text-gray-400">
                    No
                  </div>
                )}
              </div>

              {/* 출고날짜 */}
              <div className="text-gray-700">{new Date(it.date).toLocaleString()}</div>

              {/* 제품번호/제품명 (가운데 정렬로 통일) */}
              <div className="text-center">
                <div className="font-medium">{it.code}</div>
                <div className="text-xs text-gray-500">{it.name}</div>
              </div>

              {/* 브랜드/분류 */}
              <div>
                <div>{brandOf(it.productId)}</div>
                <div className="text-xs text-gray-500">
                  {major}
                  {minor ? ` > ${minor}` : ""}
                </div>
              </div>

              {/* 사이즈 */}
              <div className="font-medium">{it.size}</div>

              {/* 매출처 */}
              <div>{partnerLabel(it.partnerId)}</div>

              {/* 판매가 (숫자만 + 입력 즉시 천단위 콤마) */}
              <div>
                <input
                  className="w-28 border rounded-xl px-3 py-2 text-right"
                  value={withCommas(it.settlementPrice ?? "")}
                  onChange={(e) => onChangePrice(it.id, e.target.value)}
                  placeholder="판매가"
                  inputMode="numeric"
                />
              </div>

              {/* 매입가 */}
              <div className="font-medium">{fmt(unitCost)}</div>

              {/* 예상마진 */}
              <div className={`${margin < 0 ? "text-rose-600" : "text-emerald-700"} font-medium`}>
                {fmt(Number.isFinite(margin) ? margin : 0)}
              </div>

              {/* 삭제 */}
              <div className="text-right pr-2">
                <button onClick={() => onDelete(it.id)} className="text-red-600 font-bold">
                  X
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 우측 정산 버튼 */}
      <div className="flex justify-end">
        <button onClick={onSettle} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">
          정산
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
    </div>
  );
}
