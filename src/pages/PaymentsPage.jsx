// src/pages/PaymentsPage.jsx
import React from "react";
import { LS, save } from "../lib/storage.js";
import { uid } from "../lib/uid.js";

const onlyDigits = (s = "") => (s + "").replace(/\D/g, "");
const formatCardNumber = (s = "") =>
  onlyDigits(s).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1-");

/* ====== 상단 토스트 (OutLaterListPage와 동일 스타일) ====== */
function Toast({ open, type = "success", message = "" }) {
  const color =
    type === "success" ? "bg-emerald-600" : type === "warning" ? "bg-amber-500" : "bg-rose-600";
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

/* ============== 상세 보기 모달 (행 클릭) ============== */
function PaymentDetailModal({ item, onClose }) {
  if (!item) return null;
  const isCard = item.type === "card";
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">결제수단 상세</h3>
            <button onClick={onClose} className="text-gray-500">✕</button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-500">구분</div>
                <div className="font-medium">
                  {isCard ? item.cardKind : item.acctKind}
                </div>
              </div>
              {/* 사용여부는 목록/입력에서 제거 요청이지만, 상세보기엔 유지해도 된다는 언급이 없어 일단 표시 유지 */}
              <div>
                <div className="text-gray-500">사용여부</div>
                <div className="font-medium">{item.useYn ? "O" : "X"}</div>
              </div>
              {isCard ? (
                <>
                  <div>
                    <div className="text-gray-500">카드명(별칭)</div>
                    <div className="font-medium">{item.cardName}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">카드번호</div>
                    <div className="font-medium">
                      {(item.cardNo || "").replace(/(\d{4})(?=\d)/g, "$1-")}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">결제 은행</div>
                    <div className="font-medium">{item.cardBank || "-"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">결제 계좌</div>
                    <div className="font-medium">{item.cardAcct || "-"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">카드 명의</div>
                    <div className="font-medium">{item.cardHolder || "-"}</div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-gray-500">계좌명(별칭)</div>
                    <div className="font-medium">{item.acctName}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">계좌번호</div>
                    <div className="font-medium">{item.acctNo}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">은행명</div>
                    <div className="font-medium">{item.acctBank}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">통장명의</div>
                    <div className="font-medium">{item.acctHolder || "-"}</div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="p-4 border-t flex items-center justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== 추가/수정 모달 ============== */
function PaymentModal({ onClose, onSave, initial, notify }) {
  const isEdit = !!initial;
  const fixedType = initial?.type || null;
  const [type, setType] = React.useState(initial?.type || "card");

  // 사용여부 UI는 제거하지만, 데이터는 기본 true로 저장(호환성)
  const [useYn] = React.useState(
    typeof initial?.useYn === "boolean" ? initial.useYn : true
  );

  // 카드
  const [cardKind, setCardKind] = React.useState(initial?.cardKind || "개인신용");
  const [cardName, setCardName] = React.useState(initial?.cardName || "");
  const [cardNo, setCardNo] = React.useState(initial?.cardNo || "");
  const [cardBank, setCardBank] = React.useState(initial?.cardBank || "");
  const [cardAcct, setCardAcct] = React.useState(initial?.cardAcct || "");
  const [cardHolder, setCardHolder] = React.useState(initial?.cardHolder || "");

  // 계좌
  const [acctKind, setAcctKind] = React.useState(initial?.acctKind || "개인계좌");
  const [acctName, setAcctName] = React.useState(initial?.acctName || "");
  const [acctNo, setAcctNo] = React.useState(initial?.acctNo || "");
  const [acctBank, setAcctBank] = React.useState(initial?.acctBank || "");
  const [acctHolder, setAcctHolder] = React.useState(initial?.acctHolder || "");

  const canSwitchType = !isEdit;

  // 필수 입력 검증(빨간 테두리)
  const invalid = {
    cardName: type === "card" && !cardName.trim(),
    cardNo: type === "card" && onlyDigits(cardNo).length < 15, // 15~16자리 허용
    acctName: type === "account" && !acctName.trim(),
    acctNo: type === "account" && !(acctNo && /^[\d-]+$/.test(acctNo)),
    acctBank: type === "account" && !acctBank.trim(),
  };

  const saveData = () => {
    if (type === "card") {
      if (invalid.cardName || invalid.cardNo) {
        notify?.("warning", "카드명/카드번호를 정확히 입력하세요.");
        return;
      }
      onSave({
        type: "card",
        useYn,
        cardKind,
        cardName: cardName.trim(),
        cardNo: formatCardNumber(cardNo),
        cardBank: cardBank.trim(),
        cardAcct: cardAcct.trim(),
        cardHolder: cardHolder.trim(),
      });
    } else {
      if (invalid.acctName || invalid.acctNo || invalid.acctBank) {
        notify?.("warning", "계좌명/계좌번호/은행명을 정확히 입력하세요.");
        return;
      }
      onSave({
        type: "account",
        useYn,
        acctKind,
        acctName: acctName.trim(),
        acctNo: acctNo.trim(),
        acctBank: acctBank.trim(),
        acctHolder: acctHolder.trim(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{isEdit ? "결제 정보 수정" : "결제 정보 추가"}</h3>
            <button onClick={onClose} className="text-gray-500">✕</button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">입력 유형</span>
              {canSwitchType ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setType("card")}
                    className={`px-3 py-2 rounded-xl border ${
                      type === "card" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                    }`}
                  >
                    카드정보 입력
                  </button>
                  <button
                    onClick={() => setType("account")}
                    className={`px-3 py-2 rounded-xl border ${
                      type === "account" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                    }`}
                  >
                    계좌정보 입력
                  </button>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-gray-50">
                  <span className="text-gray-500">고정</span>
                  <span className="font-medium">
                    {fixedType === "card" ? "카드정보 입력" : "계좌정보 입력"}
                  </span>
                </div>
              )}
            </div>

            {type === "card" ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">카드 구분</div>
                  <div className="flex flex-wrap gap-2">
                    {["개인신용","개인체크","사업신용","사업체크","법인신용","법인체크"].map((k) => (
                      <label
                        key={k}
                        className={`px-3 py-2 rounded-xl border cursor-pointer ${
                          cardKind === k ? "bg-indigo-50 border-indigo-400" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          className="mr-2"
                          name="cardKind"
                          checked={cardKind === k}
                          onChange={() => setCardKind(k)}
                        />
                        {k}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">카드명 (별칭)</label>
                  <input
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 ${
                      invalid.cardName ? "border-rose-400 bg-rose-50" : ""
                    }`}
                    placeholder="예: 우리카드 스카이패스"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">카드번호</label>
                  <input
                    value={formatCardNumber(cardNo)}
                    onChange={(e) => setCardNo(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 ${
                      invalid.cardNo ? "border-rose-400 bg-rose-50" : ""
                    }`}
                    placeholder="예: 0000-0000-0000-000"
                    inputMode="numeric"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">결제 은행</label>
                    <input
                      value={cardBank}
                      onChange={(e) => setCardBank(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                      placeholder="입력칸(선택)"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">결제 계좌</label>
                    <input
                      value={cardAcct}
                      onChange={(e) => setCardAcct(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2"
                      placeholder="입력칸(선택)"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">카드 명의</label>
                  <input
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                    placeholder="입력칸(선택)"
                  />
                </div>
                {/* '사용 O/X' 섹션 제거 */}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">계좌 구분</div>
                  <div className="flex flex-wrap gap-2">
                    {["개인계좌","사업계좌","법인계좌"].map((k) => (
                      <label
                        key={k}
                        className={`px-3 py-2 rounded-xl border cursor-pointer ${
                          acctKind === k ? "bg-indigo-50 border-indigo-400" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          className="mr-2"
                          name="acctKind"
                          checked={acctKind === k}
                          onChange={() => setAcctKind(k)}
                        />
                        {k}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">계좌명 (별칭)</label>
                  <input
                    value={acctName}
                    onChange={(e) => setAcctName(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 ${
                      invalid.acctName ? "border-rose-400 bg-rose-50" : ""
                    }`}
                    placeholder="예: 사업자통장"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">계좌번호</label>
                    <input
                      value={acctNo}
                      onChange={(e) => setAcctNo((e.target.value || "").replace(/[^\d-]/g, ""))}
                      className={`w-full border rounded-xl px-3 py-2 ${
                        invalid.acctNo ? "border-rose-400 bg-rose-50" : ""
                      }`}
                      placeholder="예: 0000-00-000000"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">은행명</label>
                    <input
                      value={acctBank}
                      onChange={(e) => setAcctBank(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 ${
                        invalid.acctBank ? "border-rose-400 bg-rose-50" : ""
                      }`}
                      placeholder="예: 우리은행"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">통장명의</label>
                  <input
                    value={acctHolder}
                    onChange={(e) => setAcctHolder(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2"
                    placeholder="입력칸(선택)"
                  />
                </div>
                {/* '사용 O/X' 섹션 제거 */}
              </div>
            )}
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">
              취소
            </button>
            <button onClick={saveData} className="px-4 py-2 rounded-xl bg-sky-500 text-white">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== 목록/검색/탭 ============== */
export default function PaymentsPage({ payments, setPayments }) {
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState("card"); // 'card' | 'account'
  const [showModal, setShowModal] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState(null);
  const [detailTarget, setDetailTarget] = React.useState(null);

  // 토스트
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
  React.useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = payments.filter((p) => p.type === tab);
    if (t) {
      list = list.filter((p) => {
        const name = (p.type === "card" ? p.cardName : p.acctName) || "";
        return name.toLowerCase().includes(t);
      });
    }
    return list.sort((a, b) => {
      const na = (a.type === "card" ? a.cardName : a.acctName) || "";
      const nb = (b.type === "card" ? b.cardName : b.acctName) || "";
      return na.localeCompare(nb);
    });
  }, [payments, q, tab]);

  const onCreate = (data) => {
    const next = [...payments, { id: uid(), createdAt: new Date().toISOString(), ...data }];
    setPayments(next);
    save(LS.PAYMENTS, next);
    setShowModal(false);
    showToast("success", "저장되었습니다.");
  };
  const onUpdate = (id, data) => {
    const next = payments.map((p) => (p.id === id ? { ...p, ...data } : p));
    setPayments(next);
    save(LS.PAYMENTS, next);
    setEditTarget(null);
    showToast("success", "저장되었습니다.");
  };
  const onDelete = (id) => {
    if (!confirm("이 결제수단을 삭제할까요?")) return;
    const next = payments.filter((p) => p.id !== id);
    setPayments(next);
    save(LS.PAYMENTS, next);
    showToast("success", "삭제되었습니다.");
  };

  return (
    <div className="space-y-3 relative">
      {/* 토스트 */}
      <Toast open={toast.open} type={toast.type} message={toast.message} />

      {/* 검색 + 추가 */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 border rounded-xl px-3 py-2 bg-white"
          placeholder="카드명, 별칭 으로 검색..."
        />
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">
          + 결제수단 추가
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("card")}
          className={`px-3 py-2 rounded-xl border ${tab === "card" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"}`}
        >
          카드 정보
        </button>
        <button
          onClick={() => setTab("account")}
          className={`px-3 py-2 rounded-xl border ${tab === "account" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"}`}
        >
          계좌 정보
        </button>
      </div>

      {/* 목록 (모든 글씨 가운데 정렬 / '사용여부' 컬럼 제거) */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <table className="w-full table-auto text-sm">
          <thead>
            {tab === "card" ? (
              <tr className="text-center text-gray-600 border-b">
                <th className="py-2 w-24">구분</th>
                <th className="py-2 w-64">카드명</th>
                <th className="py-2 w-64">카드번호</th>
                <th className="py-2 w-40">카드명의</th>
                <th className="py-2 w-24">관리</th>
              </tr>
            ) : (
              <tr className="text-center text-gray-600 border-b">
                <th className="py-2 w-24">구분</th>
                <th className="py-2 w-64">계좌명</th>
                <th className="py-2 w-64">계좌번호</th>
                <th className="py-2 w-40">은행명</th>
                <th className="py-2 w-40">통장명의</th>
                <th className="py-2 w-24">관리</th>
              </tr>
            )}
          </thead>
          <tbody className="text-center">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={tab === "card" ? 5 : 6} className="py-4 text-gray-500 text-center">
                  등록된 항목이 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((p) =>
              tab === "card" ? (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.cardKind}
                  </td>
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.cardName}
                  </td>
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {formatCardNumber(p.cardNo)}
                  </td>
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.cardHolder || "-"}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2 justify-center">
                      <button title="수정" onClick={() => setEditTarget(p)} className="p-1 rounded hover:bg-gray-100">
                        ✎
                      </button>
                      <button title="삭제" onClick={() => onDelete(p.id)} className="p-1 rounded hover:bg-gray-100">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.acctKind}
                  </td>
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.acctName}
                  </td>
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.acctNo}
                  </td>
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.acctBank}
                  </td>
                  <td className="py-2 cursor-pointer" onClick={() => setDetailTarget(p)}>
                    {p.acctHolder || "-"}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2 justify-center">
                      <button title="수정" onClick={() => setEditTarget(p)} className="p-1 rounded hover:bg-gray-100">
                        ✎
                      </button>
                      <button title="삭제" onClick={() => onDelete(p.id)} className="p-1 rounded hover:bg-gray-100">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* 모달들 */}
      {showModal && (
        <PaymentModal
          onClose={() => setShowModal(false)}
          onSave={onCreate}
          notify={showToast}
        />
      )}
      {editTarget && (
        <PaymentModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(data) => onUpdate(editTarget.id, data)}
          notify={showToast}
        />
      )}
      {detailTarget && <PaymentDetailModal item={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  );
}
