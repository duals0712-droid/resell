// src/pages/ReturnsExchangePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { uid } from "../lib/uid.js";

/* ===== 공통 유틸 ===== */
const fmt = (n) => (Number(n) || 0).toLocaleString();

// ISO → 로컬기준 YYYY-MM-DD
const ymdLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// 오늘(로컬) YYYY-MM-DD
const todayLocalYmd = (dateLike) => {
  const d = dateLike ? new Date(dateLike) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// 로컬 YYYY-MM-DD 문자열끼리 일수 차이 (to - from)
const daysBetween = (fromYmd, toYmd) => {
  const f = new Date(fromYmd + "T00:00:00");
  const t = new Date(toYmd + "T00:00:00");
  return Math.round((t - f) / 86400000);
};

// LOT 생성 시퀀스(다른 곳과 동일 키 유지)
function nextLotSeq(lotsArr = []) {
  const maxSeq = Math.max(0, ...[0, ...lotsArr.map(l => Number(l?.createdSeq) || 0)]);
  return maxSeq + 1;
}

/* ===== 상단 토스트 (OutLater 스타일) ===== */
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

/* ===== 정렬 가능한 헤더 셀 ===== */
function SortableTh({ label, field, sortBy, sortDir, onSort }) {
  const active = sortBy === field;
  const arrow = !active ? "" : sortDir === "asc" ? "▲" : "▼";
  return (
    <button
      onClick={() => onSort(field)}
      className={[
        "w-full px-2 py-2 text-sm transition-colors duration-200 whitespace-nowrap",
        "hover:bg-gray-50 rounded text-center",
        active ? "font-semibold text-indigo-700" : "font-normal text-gray-900",
      ].join(" ")}
      title={`${label}로 정렬`}
    >
      {label} {arrow && <span>{arrow}</span>}
    </button>
  );
}

/* ===== 모달 컨테이너 ===== */
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-100 transition-opacity"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200"
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ===== 메인 페이지 ===== */
export default function ReturnsExchangePage({
  products = [],
  partners = [],
  payments = [],
  lots: lotsProp, // App에서 넘기면 사용
  setLots: setLotsProp,
  ioRec: ioRecProp,
  setIoRec: setIoRecProp,
}) {
  // lots/ioRec 원천
  const [lots, setLots] = useState(lotsProp ?? []);
  const [ioRec, setIoRec] = useState(ioRecProp ?? []);

  // 토스트 상태
  const [toast, setToast] = useState({ open: false, type: "success", message: "" });
  const toastTimer = useRef(null);
  const showToast = (type, message, ms = 2000) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast({ open: true, type, message });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), ms);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // 변경 저장 래퍼
  const commitLots = (next) => {
    setLots(next);
    if (setLotsProp) setLotsProp(next);
  };
  const commitIo = (next) => {
    setIoRec(next);
    if (setIoRecProp) setIoRecProp(next);
  };

  const productById = (id) => products.find((p) => p.id === id);
  const partnerById = (id) => partners.find((p) => p.id === id);
  const paymentById = (id) => payments.find((p) => p.id === id);

  /* ===== 행 데이터 구성 ===== */
  const rows = useMemo(() => {
    const _today = todayLocalYmd();

    const all = (lots || []).map((l) => {
      const p = productById(l.productId) || {};
      const partner = partnerById(l.partnerId) || {};
      const pay = paymentById(l.paymentId) || {};

      const confirmedQty = Number(l.confirmedQty || 0);
      const qty = Number(l.qty) || 0;
      const available = Math.max(0, qty - confirmedQty); // 반품/교환 가능수량

      const recvDate = ymdLocal(l.receivedAt); // (중요) 로컬 기준 매입일
      const returnDays = Number(partner.returnDays || 0);

      const deadlineDate = new Date(`${recvDate}T00:00:00`);
      deadlineDate.setDate(deadlineDate.getDate() + returnDays);
      const deadline = todayLocalYmd(deadlineDate);

      const remaining = Math.max(0, daysBetween(_today, deadline)); // 음수면 0

      // 결제수단 표시
      let paymentLabel = "-";
      if (pay?.type === "card") {
        const last4 = String(pay.cardNo || "").replace(/\D/g, "").slice(-4);
        paymentLabel = `${pay.cardName || "카드"} (${last4})`;
      } else if (pay?.type === "account") {
        const last4 = String(pay.acctNo || "").replace(/\D/g, "").slice(-4);
        paymentLabel = `${pay.acctBank || ""} - ${pay.acctName || ""} (${last4})`;
      }

      // 거래처명(상호명)
      const partnerLabel = (() => {
        if (!partner) return "-";
        const biz = partner.bizName || partner.company || partner.alias || "";
        return biz ? `${partner.name}(${biz})` : partner.name || "-";
      })();

      // 분류
      const [major, minor] = String(p.category || "").split(">").map((s) => (s || "").trim());

      return {
        lotId: l.id,
        productId: l.productId,
        code: p.code || "",
        name: p.name || "",
        size: l.size || "",
        brand: p.brand || "-",
        major: major || "-",
        minor: minor || "",
        partnerId: l.partnerId,
        partnerLabel,
        purchasePrice: Number(l.purchasePrice) || 0,
        paymentId: l.paymentId,
        paymentLabel,
        receivedAt: l.receivedAt,
        recvDate,
        deadline,
        remaining,
        availableQty: available,
      };
    });

    // 가용 수량 0은 목록에서 제거
    return all.filter((r) => r.availableQty > 0);
  }, [lots, products, partners, payments]);

  /* ===== 정렬 ===== */
  const [sortBy, setSortBy] = useState("remaining"); // 기본: 남은기한
  const [sortDir, setSortDir] = useState("asc");
  const onSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };
  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va || "").localeCompare(String(vb || "")) * dir;
    });
    return arr;
  }, [rows, sortBy, sortDir]);

  /* ===== 마감일 경과 시 자동 구매확정 ===== */
  useEffect(() => {
    const _today = todayLocalYmd();
    let changed = false;

    const next = (lots || []).map((l) => {
      const partner = partnerById(l.partnerId);
      const returnDays = Number(partner?.returnDays || 0);

      const recvYmd = ymdLocal(l.receivedAt);
      const deadlineDate = new Date(`${recvYmd}T00:00:00`);
      deadlineDate.setDate(deadlineDate.getDate() + returnDays);
      const deadlineYmd = todayLocalYmd(deadlineDate);

      if (_today > deadlineYmd) {
        const qty = Number(l.qty) || 0;
        const confirmed = Number(l.confirmedQty || 0);
        if (qty > confirmed) {
          changed = true;
          return { ...l, confirmedQty: qty };
        }
      }
      return l;
    });

    if (changed) {
      commitLots(next);
      showToast("success", "기한 경과 건을 자동 구매확정 처리했습니다.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, partners]);

  /* ===== 모달 상태 ===== */
  const [modal, setModal] = useState({
    type: null, // 'return' | 'exchange' | 'confirm'
    open: false,
    row: null,
  });

  // 입력 상태(공용)
  const [qtyInput, setQtyInput] = useState("");
  const [targetSize, setTargetSize] = useState(""); // 교환용

  const closeModal = () => {
    setModal({ type: null, open: false, row: null });
    setQtyInput("");
    setTargetSize("");
  };

  const clampQty = (val, max) => {
    const n = Math.max(0, Number(val || 0));
    return Math.min(n, Math.max(0, Number(max || 0)));
  };

  /* ===== 액션들 ===== */

  // 반품: LOT.qty 감소(실시간 재고 반영) + IO 기록(+거래처/결제/매입일) + 토스트
  const doReturn = () => {
    const row = modal.row;
    if (!row) return;

    const maxAvail = Number(row.availableQty || 0);
    const req = clampQty(qtyInput, maxAvail);

    if (req <= 0) {
      alert("반품 수량을 1 이상 입력하세요.");
      return;
    }
    if (req > maxAvail) {
      alert("반품가능수량을 초과했습니다.");
      return;
    }

    const nextLots = (lots || []).map((l) => {
      if (l.id !== row.lotId) return l;
      const qty = Math.max(0, Number(l.qty) || 0);
      return { ...l, qty: Math.max(0, qty - req) }; // 재고 차감
    });

    const nowIso = new Date().toISOString();
    const rec = {
      id: uid(),
      type: "반품",
      date: nowIso,
      productId: row.productId,
      code: row.code,
      name: row.name,
      size: row.size,
      qty: req,
      unitPurchase: row.purchasePrice,
      totalPurchase: req * row.purchasePrice,
      partnerId: row.partnerId ?? null,     // ✅ 추가
      paymentId: row.paymentId ?? null,     // ✅ 추가
      receivedAt: row.receivedAt ?? null,   // ✅ 추가 (LOT 매입일)
      memo: "반품 처리",
    };

    commitLots(nextLots);
    commitIo([...(ioRec || []), rec]);
    closeModal();
    showToast("danger", `반품 처리 완료: ${row.name} (${row.size}) - ${fmt(req)}개`);
  };

  // 교환: 원 LOT.qty 감소 + 원 매입일 승계 새 LOT 추가 + IO 기록(+거래처/결제/매입일) + 토스트
  const doExchange = () => {
    const row = modal.row;
    if (!row) return;

    const maxAvail = Number(row.availableQty || 0);
    const req = clampQty(qtyInput, maxAvail);

    if (req <= 0) {
      alert("교환 수량을 1 이상 입력하세요.");
      return;
    }
    if (!targetSize) {
      alert("교환할 사이즈를 선택하세요.");
      return;
    }
    if (targetSize === row.size) {
      alert("동일 사이즈로 교환할 수 없습니다.");
      return;
    }
    if (req > maxAvail) {
      alert("교환가능수량을 초과했습니다.");
      return;
    }

    const srcIdx = (lots || []).findIndex((l) => l.id === row.lotId);
    if (srcIdx < 0) {
      alert("대상 LOT을 찾을 수 없습니다.");
      return;
    }
    const src = lots[srcIdx];

    const nextLots = [...lots];
    const srcQty = Math.max(0, Number(src.qty) || 0);
    nextLots[srcIdx] = { ...src, qty: Math.max(0, srcQty - req) };

    const newLot = {
      id: uid(),
      productId: src.productId,
      size: targetSize,
      qty: req,
      purchasePrice: Number(src.purchasePrice) || 0,
      partnerId: src.partnerId ?? null,
      paymentId: src.paymentId ?? null,
      receivedAt: src.receivedAt,                // 원 매입일 승계
      receivedYmd: src.receivedYmd ?? undefined, // 사용 중이면 유지
      createdAt: new Date().toISOString(),
      createdSeq: nextLotSeq(lots),
    };
    nextLots.push(newLot);

    const nowIso = new Date().toISOString();
    const rec = {
      id: uid(),
      type: "교환",
      date: nowIso,
      productId: row.productId,
      code: row.code,
      name: row.name,
      fromSize: row.size,                         // ✅ 원본 사이즈
      toSize: targetSize,                         // ✅ 변경 사이즈
      size: `${row.size} → ${targetSize}`,        // (하위호환)
      qty: req,
      unitPurchase: row.purchasePrice,
      totalPurchase: req * row.purchasePrice,
      partnerId: src.partnerId ?? null,          // ✅ 추가
      paymentId: src.paymentId ?? null,          // ✅ 추가
      receivedAt: src.receivedAt ?? null,        // ✅ 추가 (LOT 매입일)
      memo: `원 매입일 ${row.recvDate} 승계`,
    };

    commitLots(nextLots);
    commitIo([...(ioRec || []), rec]);
    closeModal();
    showToast("warning", `교환 완료: ${row.name} ${row.size} → ${targetSize} / ${fmt(req)}개`);
  };

  // 구매확정: 선택 수량만큼 confirmedQty 증가 + 토스트
  const doConfirm = () => {
    const row = modal.row;
    if (!row) return;

    const maxAvail = Number(row.availableQty || 0);
    const req = clampQty(qtyInput, maxAvail);

    if (req <= 0) {
      alert("구매확정 수량을 1 이상 입력하세요.");
      return;
    }
    if (req > maxAvail) {
      alert("구매확정 가능수량을 초과했습니다.");
      return;
    }

    const nextLots = (lots || []).map((l) => {
      if (l.id !== row.lotId) return l;
      const confirmed = Number(l.confirmedQty || 0);
      return { ...l, confirmedQty: confirmed + req };
    });

    const nowIso = new Date().toISOString();
    const rec = {
      id: uid(),
      type: "구매확정",
      date: nowIso,
      productId: row.productId,
      code: row.code,
      name: row.name,
      size: row.size,
      qty: req,
      unitPurchase: row.purchasePrice,
      totalPurchase: req * row.purchasePrice,
      partnerId: row.partnerId ?? null,     // 함께 기록(참고)
      paymentId: row.paymentId ?? null,     // 함께 기록(참고)
      receivedAt: row.receivedAt ?? null,   // 함께 기록(참고)
      memo: "부분 구매확정",
    };

    commitLots(nextLots);
    commitIo([...(ioRec || []), rec]);
    closeModal();
    showToast("success", `구매확정 완료: ${row.name} (${row.size}) - ${fmt(req)}개`);
  };

  /* ===== 테이블 헤더 (모두 중앙정렬) =====
     요구 순서: 매입처,품번,상품명,사이즈,반품가능수량,매입가,결제수단,매입일,반품마감일,남은기한,처리
     * 정렬 불가 탭은 font-normal 유지
  */
  const tableHeaders = (
    <thead className="bg-gray-50">
      <tr className="text-center">
        <th className="px-2 py-2 font-normal whitespace-nowrap">매입처</th>
        <th className="px-2 py-2"><SortableTh label="품번" field="code" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
        <th className="px-2 py-2 font-normal whitespace-nowrap">상품명</th>
        <th className="px-2 py-2"><SortableTh label="사이즈" field="size" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
        <th className="px-2 py-2 font-normal whitespace-nowrap">반품가능수량</th>
        <th className="px-2 py-2 font-normal whitespace-nowrap">매입가</th>
        <th className="px-2 py-2 font-normal whitespace-nowrap">결제수단</th>
        <th className="px-2 py-2"><SortableTh label="매입일" field="recvDate" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
        <th className="px-2 py-2"><SortableTh label="반품마감일" field="deadline" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
        <th className="px-2 py-2"><SortableTh label="남은기한" field="remaining" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
        <th className="px-2 py-2 font-normal whitespace-nowrap">처리</th>
      </tr>
    </thead>
  );

  /* ===== UI ===== */
  return (
    <div className="space-y-6">
      {/* 토스트 */}
      <Toast open={toast.open} type={toast.type} message={toast.message} />

      <h2 className="text-xl font-bold">반품/교환 관리</h2>

      {/* 테이블: 가로 스크롤 보장 + 줄바꿈 금지 */}
      <div className="w-full overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-[1120px] w-full text-sm whitespace-nowrap">
          {tableHeaders}
          <tbody className="text-center">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-gray-500">
                  표시할 항목이 없습니다.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.lotId} className="border-t">
                  <td className="px-2 py-2">{r.partnerLabel}</td>
                  <td className="px-2 py-2">{r.code}</td>
                  <td className="px-2 py-2">{r.name}</td>
                  <td className="px-2 py-2">{r.size}</td>
                  <td className="px-2 py-2">{fmt(r.availableQty)}</td>
                  <td className="px-2 py-2">{fmt(r.purchasePrice)}</td>
                  <td className="px-2 py-2">{r.paymentLabel}</td>
                  <td className="px-2 py-2">{r.recvDate}</td>
                  <td className="px-2 py-2">{r.deadline}</td>
                  <td className="px-2 py-2">
                    <span className="font-bold text-rose-600">{fmt(r.remaining)}일</span>
                  </td>
                  <td className="px-2 py-2">
                    <div className="inline-flex gap-2">
                      <button
                        className="px-3 py-1 rounded-lg bg-rose-600 text-white whitespace-nowrap"
                        onClick={() => {
                          setQtyInput("");
                          setModal({ type: "return", open: true, row: r });
                        }}
                      >
                        반품
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg bg-indigo-600 text-white whitespace-nowrap"
                        onClick={() => {
                          setQtyInput("");
                          setTargetSize("");
                          setModal({ type: "exchange", open: true, row: r });
                        }}
                      >
                        교환
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white whitespace-nowrap"
                        onClick={() => {
                          setQtyInput("");
                          setModal({ type: "confirm", open: true, row: r });
                        }}
                      >
                        구매확정
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ====== 모달들 ====== */}
      {/* 반품 처리 */}
      <Modal open={modal.open && modal.type === "return"} onClose={closeModal}>
        <div className="p-4 border-b font-semibold">반품 처리</div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-gray-600">
            {modal.row ? `[${modal.row.code}] ${modal.row.name} / ${modal.row.size}` : ""}
          </div>
          <div className="text-sm">반품가능수량: <b>{fmt(modal.row?.availableQty || 0)}</b></div>
          <input
            type="number"
            min={1}
            max={Math.max(0, modal.row?.availableQty || 0)}
            placeholder="반품 수량"
            value={qtyInput}
            onChange={(e) =>
              setQtyInput(String(clampQty(e.target.value, modal.row?.availableQty || 0)))
            }
            className="w-full border rounded-xl px-3 py-2"
          />
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button onClick={closeModal} className="px-4 py-2 rounded-xl border">
            취소
          </button>
          <button onClick={doReturn} className="px-4 py-2 rounded-xl bg-rose-600 text-white">
            반품
          </button>
        </div>
      </Modal>

      {/* 교환 처리 */}
      <Modal open={modal.open && modal.type === "exchange"} onClose={closeModal}>
        <div className="p-4 border-b font-semibold">교환 처리</div>
        <div className="p-4 space-y-3">
          <div className="text-sm text-gray-600">
            {modal.row ? `[${modal.row.code}] ${modal.row.name}` : ""}<br />
            현재 사이즈: <b>{modal.row?.size}</b> / 가능수량: <b>{fmt(modal.row?.availableQty || 0)}</b>
          </div>

          {/* 수량 입력 (가능수량 초과 불가) */}
          <input
            type="number"
            min={1}
            max={Math.max(0, modal.row?.availableQty || 0)}
            placeholder="교환 수량"
            value={qtyInput}
            onChange={(e) =>
              setQtyInput(String(clampQty(e.target.value, modal.row?.availableQty || 0)))
            }
            className="w-full border rounded-xl px-3 py-2"
          />

          {/* 교환 사이즈 선택 */}
          {(() => {
            const p = modal.row ? products.find((x) => x.id === modal.row.productId) : null;
            const sizes = Array.isArray(p?.sizes) ? p.sizes : [];
            const options = sizes.filter((s) => s !== modal.row?.size);
            return (
              <select
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={targetSize}
                onChange={(e) => setTargetSize(e.target.value)}
              >
                <option value="">교환할 사이즈 선택</option>
                {options.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            );
          })()}

          <p className="text-xs text-gray-500">
            ※ 교환으로 생성되는 LOT은 <b>원 매입일({modal.row?.recvDate})</b>을 그대로 승계합니다.
          </p>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button onClick={closeModal} className="px-4 py-2 rounded-xl border">
            취소
          </button>
          <button onClick={doExchange} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">
            교환
          </button>
        </div>
      </Modal>

      {/* 구매확정 */}
      <Modal open={modal.open && modal.type === "confirm"} onClose={closeModal}>
        <div className="p-4 border-b font-semibold">구매확정</div>
        <div className="p-4 space-y-2">
          <div className="text-sm text-gray-600">
            {modal.row ? `[${modal.row.code}] ${modal.row.name} / ${modal.row.size}` : ""}
          </div>
          <div className="text-sm">
            확정 가능한 수량: <b>{fmt(modal.row?.availableQty || 0)}</b>
          </div>
          <input
            type="number"
            min={1}
            max={Math.max(0, modal.row?.availableQty || 0)}
            placeholder="구매확정 수량"
            value={qtyInput}
            onChange={(e) =>
              setQtyInput(String(clampQty(e.target.value, modal.row?.availableQty || 0)))
            }
            className="w-full border rounded-xl px-3 py-2"
          />
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button onClick={closeModal} className="px-4 py-2 rounded-xl border">
            취소
          </button>
          <button onClick={doConfirm} className="px-4 py-2 rounded-xl bg-emerald-600 text-white">
            구매확정
          </button>
        </div>
      </Modal>
    </div>
  );
}
