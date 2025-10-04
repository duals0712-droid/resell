// src/pages/CouriersPage.jsx
import React from "react";
import { uid } from "../lib/uid.js";
/* ============== 유틸 ============== */
const parseCost = (s = "") => Number((s + "").replace(/[^\d]/g, "") || 0);
const fmtCost = (n = 0) => (Number(n) || 0).toLocaleString() + "원";
const fmtInputCost = (s = "") => {
  const n = parseCost(s);
  return n ? n.toLocaleString() : "";
};

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

/* ============== 추가/수정 모달 ============== */
function CourierModal({ onClose, onSave, initial, notify }) {
  const isEdit = !!initial;
  const [name, setName] = React.useState(initial?.name || "");
  const [contractCode, setContractCode] = React.useState(initial?.contractCode || "");
  const [tiers, setTiers] = React.useState(
    initial?.tiers?.length
      ? initial.tiers.map((t) => ({
          id: t.id || uid(),
          sizeLabel: t.sizeLabel || "",
          condition: t.condition || "",
          cost: t.cost != null ? fmtInputCost(String(t.cost)) : "",
        }))
      : [{ id: uid(), sizeLabel: "", condition: "", cost: "" }]
  );
  const [triedSave, setTriedSave] = React.useState(false);

  const addTier = () =>
    setTiers((ts) => [...ts, { id: uid(), sizeLabel: "", condition: "", cost: "" }]);
  const removeTier = (id) => setTiers((ts) => (ts.length > 1 ? ts.filter((t) => t.id !== id) : ts));
  const updateTier = (id, patch) => setTiers((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const saveData = () => {
    setTriedSave(true);

    if (!name.trim()) {
      notify?.("warning", "택배사명을 입력하세요.");
      return;
    }

    // 입력된(어느 칸이든 채워진) 행만 모음
    const normalized = tiers
      .map((t) => ({
        id: t.id,
        sizeLabel: (t.sizeLabel || "").trim(),
        condition: (t.condition || "").trim(),
        cost: parseCost(t.cost),
        _rawHasAny: !!((t.sizeLabel || "").trim() || (t.condition || "").trim() || parseCost(t.cost) > 0),
      }))
      .filter((t) => t._rawHasAny);

    if (normalized.length === 0) {
      notify?.("warning", "박스크기/택배비용을 1개 이상 입력하세요.");
      return;
    }

    const invalidRow = normalized.find((t) => !t.sizeLabel || t.cost <= 0);
    if (invalidRow) {
      notify?.("warning", "박스크기와 택배비용은 필수입니다.");
      return;
    }

    onSave({
      name: name.trim(),
      contractCode: contractCode.trim(),
      tiers: normalized.map(({ id, sizeLabel, condition, cost }) => ({
        id,
        sizeLabel,
        condition,
        cost,
      })),
    });
  };

  const isTierActive = (t) =>
    !!((t.sizeLabel || "").trim() || (t.condition || "").trim() || parseCost(t.cost) > 0);

  const invalidName = triedSave && !name.trim();

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{isEdit ? "택배사 정보 수정" : "택배사 정보 추가"}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              ✕
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4 space-y-6">
            {/* 택배사 정보 */}
            <div>
              <div className="text-base font-semibold mb-2">택배사 정보 추가</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">택배사명 <span className="text-rose-600">*</span></label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="입력칸(필수 입력칸임)"
                    className={`w-full border rounded-xl px-3 py-2 ${
                      invalidName ? "border-rose-400 bg-rose-50" : ""
                    }`}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">계약코드(선택)</label>
                  <input
                    value={contractCode}
                    onChange={(e) => setContractCode(e.target.value)}
                    placeholder="예: 생략가능"
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* 박스크기/비용 */}
            <div>
              <div className="text-base font-semibold mb-2">박스크기/비용 추가</div>
              <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 text-sm font-medium text-gray-600 mb-1 text-center">
                <div>박스크기 <span className="text-rose-600">*</span></div>
                <div>박스조건</div>
                <div>택배비용 <span className="text-rose-600">*</span></div>
                <div />
              </div>
              <div className="space-y-2">
                {tiers.map((t) => {
                  const active = isTierActive(t);
                  const invalidSize = triedSave && active && !(t.sizeLabel || "").trim();
                  const invalidCost = triedSave && active && parseCost(t.cost) <= 0;
                  return (
                    <div key={t.id} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2">
                      <input
                        value={t.sizeLabel}
                        onChange={(e) => updateTier(t.id, { sizeLabel: e.target.value })}
                        className={`border rounded-xl px-3 py-2 ${invalidSize ? "border-rose-400 bg-rose-50" : ""}`}
                        placeholder="입력칸(필수 입력칸임)"
                      />
                      <input
                        value={t.condition}
                        onChange={(e) => updateTier(t.id, { condition: e.target.value })}
                        className="border rounded-xl px-3 py-2"
                        placeholder="예: 세변합 100cm 이하"
                      />
                      <input
                        value={t.cost}
                        onChange={(e) => updateTier(t.id, { cost: fmtInputCost(e.target.value) })}
                        className={`border rounded-xl px-3 py-2 text-right ${invalidCost ? "border-rose-400 bg-rose-50" : ""}`}
                        placeholder="예: 2,500"
                        inputMode="numeric"
                      />
                      <button
                        onClick={() => removeTier(t.id)}
                        className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                      >
                        삭제
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3">
                <button onClick={addTier} className="px-3 py-2 rounded-xl bg-gray-900 text-white">
                  + 추가
                </button>
              </div>
            </div>
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

/* ============== 한 택배사 행 + 펼침 ============== */
function DetailsRow({ courier, onEdit, onDelete }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <tr className="border-b hover:bg-gray-50 text-center">
        <td className="py-2 cursor-pointer" onClick={() => setOpen((o) => !o)}>
          {courier.name}
        </td>
        <td className="py-2 cursor-pointer" onClick={() => setOpen((o) => !o)}>
          {courier.contractCode || "-"}
        </td>
        <td className="py-2">
          <div className="flex items-center gap-2 justify-center">
            <button title="수정" onClick={onEdit} className="p-1 rounded hover:bg-gray-100">
              ✎
            </button>
            <button title="삭제" onClick={onDelete} className="p-1 rounded hover:bg-gray-100">
              🗑️
            </button>
          </div>
        </td>
      </tr>

      {open && (
        <tr className="border-b bg-gray-50">
          <td colSpan="3" className="p-0">
            <div className="p-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-center text-gray-600 border-b">
                      <th className="py-2 w-32">박스크기</th>
                      <th className="py-2">박스조건</th>
                      <th className="py-2 w-32">비용</th>
                    </tr>
                  </thead>
                  <tbody className="text-center">
                    {(courier.tiers || []).length === 0 && (
                      <tr>
                        <td colSpan="3" className="py-3 text-gray-500">
                          등록된 박스 조건이 없습니다.
                        </td>
                      </tr>
                    )}
                    {(courier.tiers || []).map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="py-2">{t.sizeLabel || "-"}</td>
                        <td className="py-2">{t.condition || "-"}</td>
                        <td className="py-2">{fmtCost(t.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ============== 목록/검색/행 펼침(메인) ============== */
export default function CouriersPage({ couriers, setCouriers }) {
  const [q, setQ] = React.useState("");
  const [showModal, setShowModal] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState(null);

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
    let list = couriers.slice();
    if (t) {
      list = list.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(t) ||
          (c.contractCode || "").toLowerCase().includes(t)
      );
    }
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [couriers, q]);

  const onCreate = (data) => {
    const next = [...couriers, { id: uid(), ...data }];
    setCouriers(next);
    setShowModal(false);
    showToast("success", "저장되었습니다.");
  };

  const onUpdate = (id, data) => {
    const next = couriers.map((c) => (c.id === id ? { ...c, ...data } : c));
    setCouriers(next);
    setEditTarget(null);
    showToast("success", "저장되었습니다.");
  };

  const onDelete = (id) => {
    if (!confirm("이 택배사를 삭제할까요?")) return;
    const next = couriers.filter((c) => c.id !== id);
    setCouriers(next);
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
          placeholder="택배사명 입력으로 검색 (실시간)"
          className="flex-1 border rounded-xl px-3 py-2 bg-white"
        />
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white"
        >
          + 택배사 추가
        </button>
      </div>

      {/* 목록 (모든 글씨 가운데 정렬) */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="text-center text-gray-600 border-b">
              <th className="py-2 w-64">택배사명</th>
              <th className="py-2 w-64">계약코드</th>
              <th className="py-2 w-24">관리</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {filtered.length === 0 && (
              <tr>
                <td colSpan="3" className="py-4 text-gray-500 text-center">
                  등록된 택배사가 없습니다.
                </td>
              </tr>
            )}

            {filtered.map((c) => (
              <React.Fragment key={c.id}>
                <DetailsRow
                  courier={c}
                  onEdit={() => setEditTarget(c)}
                  onDelete={() => onDelete(c.id)}
                />
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 추가 모달 */}
      {showModal && (
        <CourierModal
          onClose={() => setShowModal(false)}
          onSave={onCreate}
          notify={showToast}
        />
      )}

      {/* 수정 모달 */}
      {editTarget && (
        <CourierModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(data) => onUpdate(editTarget.id, data)}
          notify={showToast}
        />
      )}
    </div>
  );
}
