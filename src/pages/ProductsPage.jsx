// src/pages/ProductsPage.jsx
import React from "react";
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

/* ================== 공통: 사이즈 편집 (삭제 + 드래그 정렬 / 엔터로만 추가) ================== */
function SizesEditor({ value = [], onChange, invalid = false }) {
  const [list, setList] = React.useState(Array.isArray(value) ? value : []);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    setList(Array.isArray(value) ? value : []);
  }, [value]);

  const add = () => {
    const v = (inputRef.current?.value ?? "").trim();
    if (!v) return;
    if (list.includes(v)) {
      alert("이미 존재하는 사이즈입니다.");
      return;
    }
    const next = [...list, v];
    setList(next);
    onChange?.(next);
    inputRef.current.value = "";
  };

  const del = (sz) => {
    const next = list.filter((x) => x !== sz);
    setList(next);
    onChange?.(next);
  };

  // 드래그 정렬
  const dragIndex = React.useRef(-1);
  const onDragStart = (i) => () => (dragIndex.current = i);
  const onDragOver = (i) => (e) => e.preventDefault();
  const onDrop = (i) => (e) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === -1 || from === i) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    dragIndex.current = -1;
    setList(next);
    onChange?.(next);
  };

  return (
    <div className={`space-y-3 rounded-xl ${invalid ? "border border-rose-400 p-3 bg-rose-50" : ""}`}>
      <input
        ref={inputRef}
        className="w-full border rounded-xl px-3 py-2"
        placeholder="사이즈를 입력 후 Enter"
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
        }}
      />

      <div className="flex flex-wrap gap-2">
        {list.map((sz, i) => (
          <div
            key={sz}
            draggable
            onDragStart={onDragStart(i)}
            onDragOver={onDragOver(i)}
            onDrop={onDrop(i)}
            className="flex items-center gap-2 px-3 py-1 rounded-full border bg-white cursor-move"
            title="드래그하여 순서 변경"
          >
            <span className="font-medium">{sz}</span>
            <button type="button" onClick={() => del(sz)} className="text-red-600 font-bold leading-none">
              x
            </button>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500">Tip: 태그를 드래그하여 순서를 변경할 수 있습니다.</div>
    </div>
  );
}

/* ============= 메모 전체보기 모달 ============= */
function MemoModal({ memo, onClose }) {
  if (!memo) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">메모 전체보기</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-4">
            <pre className="whitespace-pre-wrap break-all text-sm">{memo}</pre>
          </div>
          <div className="p-4 border-t flex items-center justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">닫기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============= 새 품목 등록/수정 모달 (필수 즉시 검증 + 토스트 사용) ============= */
function ProductModal({ onClose, onCreate, onUpdate, initial, brands, categories, notify }) {
  const isEdit = !!initial;

  // 기본 정보
  const [code, setCode] = React.useState(initial?.code || "");
  const [name, setName] = React.useState(initial?.name || "");
  const [brand, setBrand] = React.useState(initial?.brand || "");

  // category는 "대분류 > 소분류" 문자열로 저장되어 있음 → id 매칭 시도
  const parseCat = (catStr = "") => {
    const [majName, minNameRaw] = (catStr || "").split(">").map((s) => (s || "").trim());
    const minName = minNameRaw || "";
    const mj = (categories || []).find((c) => c.name === majName);
    const mn = mj?.children?.find((ch) => ch.name === minName);
    return { majorId: mj?.id || "", minorId: mn?.id || "" };
  };
  const parsed = isEdit ? parseCat(initial?.category) : { majorId: "", minorId: "" };

  const [majorId, setMajorId] = React.useState(parsed.majorId);
  const [minorId, setMinorId] = React.useState(parsed.minorId);

  // 이미지/메모
  const [imgURL, setImgURL] = React.useState(initial?.image || "");
  const [imgPreview, setImgPreview] = React.useState(initial?.image || "");
  const [memo, setMemo] = React.useState(initial?.memo || "");

  // 사이즈
  const [sizes, setSizes] = React.useState(isEdit ? initial?.sizes || [] : []);

  const majors = categories || [];
  const minors = React.useMemo(() => {
    const m = majors.find((mj) => mj.id === majorId);
    return m?.children || [];
  }, [majors, majorId]);

  const onChooseFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImgPreview(e.target.result);
    reader.readAsDataURL(file);
  };
  const clearImage = () => {
    setImgURL("");
    setImgPreview("");
  };

  const buildCategoryString = () => {
    const mj = majors.find((m) => m.id === majorId);
    const mn = minors.find((m) => m.id === minorId);
    if (!mj || !mn) return "";
    return `${mj.name} > ${mn.name}`;
  };

  const normalizeSizes = (arr = []) => {
    const cleaned = arr.map((s) => String(s || "").trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  };

  // ✅ 결제수단 페이지의 방식처럼 "즉시" 빨간색 표시 (저장 시도가 아니라 값 자체로 판단)
  const invalidCode = !code.trim();
  const invalidBrand = !brand;
  const invalidName = !name.trim();
  const invalidMajor = !majorId;
  const invalidMinor = !minorId;
  const invalidSizes = normalizeSizes(sizes).length === 0;

  const save = () => {
    if (invalidCode || invalidBrand || invalidName || invalidMajor || invalidMinor || invalidSizes) {
      notify?.("warning", "필수 입력/선택 항목을 확인하세요.");
      return;
    }

    const catStr = buildCategoryString();
    if (!catStr) {
      notify?.("warning", "대분류/소분류를 선택하세요.");
      return;
    }

    const basePayload = {
      code: code.trim(),
      name: name.trim(),
      brand: brand,
      category: catStr,
      image: imgPreview || imgURL || "",
      memo,
    };

    const cleanedSizes = normalizeSizes(sizes);

    if (!isEdit) {
      onCreate({
        ...basePayload,
        sizesStr: cleanedSizes.join(","), // addProduct에서 사용
        entries: [],
      });
      return;
    }

    onUpdate({
      ...initial,
      ...basePayload,
      sizes: cleanedSizes,
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{isEdit ? "품목 수정" : "새 품목 등록"}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
              ✕
            </button>
          </div>

          {/* 스크롤 영역 */}
          <div className="max-h-[72vh] overflow-y-auto p-4 space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">
                  품번 <span className="text-rose-600">*</span>
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 ${invalidCode ? "border-rose-400 bg-rose-50" : ""}`}
                  placeholder="(예: CW2288-111)"
                  readOnly={isEdit}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">
                  브랜드(드롭다운메뉴) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 ${invalidBrand ? "border-rose-400 bg-rose-50" : ""}`}
                >
                  <option value="">선택 없음</option>
                  {(brands || []).map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600">
                상품명 <span className="text-rose-600">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 ${invalidName ? "border-rose-400 bg-rose-50" : ""}`}
                placeholder="(예: 에어포스 올백)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">
                  대분류(드롭다운메뉴) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={majorId}
                  onChange={(e) => {
                    setMajorId(e.target.value);
                    setMinorId("");
                  }}
                  className={`w-full border rounded-xl px-3 py-2 ${invalidMajor ? "border-rose-400 bg-rose-50" : ""}`}
                >
                  <option value="">대분류 선택</option>
                  {(categories || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">
                  소분류(드롭다운메뉴) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={minorId}
                  onChange={(e) => setMinorId(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 ${invalidMinor ? "border-rose-400 bg-rose-50" : ""}`}
                  disabled={!majorId}
                >
                  <option value="">소분류 선택</option>
                  {(categories.find((m) => m.id === majorId)?.children || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 이미지 업로드/URL + 미리보기 */}
            <div className="space-y-2">
              <div className="text-sm text-gray-600">이미지</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">업로드</label>
                  <input type="file" accept="image/*" onChange={(e) => onChooseFile(e.target.files?.[0])} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">URL</label>
                  <input
                    value={imgURL}
                    onChange={(e) => {
                      setImgURL(e.target.value);
                      setImgPreview(e.target.value);
                    }}
                    placeholder="https://...jpg (선택)"
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              {imgPreview && (
                <div className="relative w-40">
                  <img src={imgPreview} className="w-40 h-40 object-cover rounded-xl border" />
                  <button
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black/70 text-white"
                    title="이미지 제거"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* 사이즈 정보 (엔터로만 추가) */}
            <div className="space-y-2">
              <div className="text-base font-semibold">
                사이즈 정보 <span className="text-rose-600">*</span>
              </div>
              <SizesEditor value={sizes} onChange={setSizes} invalid={invalidSizes} />
            </div>

            {/* 메모 */}
            <div>
              <label className="text-sm text-gray-600">비고(메모) (선택)</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                rows={3}
                placeholder="자유 입력"
              />
            </div>
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border">
              취소
            </button>
            <button onClick={save} className="px-4 py-2 rounded-xl bg-sky-500 text-white">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============= 품목 목록/검색/추가 ============= */
export default function ProductsPage({
  products,
  setProducts,
  lots,
  setLots,
  addProduct,
  brands,
  categories,
}) {
  // 검색 & 모달
  const [q, setQ] = React.useState("");
  const [showModal, setShowModal] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState(null);

  // 선택 체크
  const [selectedMap, setSelectedMap] = React.useState({}); // { [productId]: true }

  // 이미지 큰 미리보기
  const [previewImage, setPreviewImage] = React.useState(null);

  // 메모 전체보기
  const [memoView, setMemoView] = React.useState("");

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
    if (!t) return [...products];
    return products.filter((p) => {
      const hay = [(p.name || ""), (p.code || ""), (p.brand || ""), (p.category || ""), (p.memo || "")]
        .join(" ")
        .toLowerCase();
      return hay.includes(t);
    });
  }, [products, q]);

  const allChecked = React.useMemo(() => {
    if (filtered.length === 0) return false;
    return filtered.every((p) => !!selectedMap[p.id]);
  }, [filtered, selectedMap]);

  const toggleAll = () => {
    if (allChecked) {
      setSelectedMap((m) => {
        const mm = { ...m };
        filtered.forEach((p) => {
          delete mm[p.id];
        });
        return mm;
      });
    } else {
      setSelectedMap((m) => {
        const mm = { ...m };
        filtered.forEach((p) => {
          mm[p.id] = true;
        });
        return mm;
      });
    }
  };

  const toggleOne = (id) => setSelectedMap((m) => ({ ...m, [id]: !m[id] }));

  // CRUD
  const onCreate = ({ code, name, brand, category, image, memo, sizesStr, entries }) => {
    addProduct(code, name, sizesStr, memo, entries, image, brand, category);
    setShowModal(false);
    showToast("success", "저장되었습니다.");
  };

  const onUpdate = (patch) => {
    const next = products.map((p) => (p.id === patch.id ? { ...p, ...patch } : p));
    setProducts(next);
    setEditTarget(null);
    showToast("success", "저장되었습니다.");
  };

  const onDelete = (productId) => {
    if (!confirm("상품과 관련 입고 기록 모두 삭제됩니다. 계속할까요?")) return;
    const np = products.filter((p) => p.id !== productId);
    const nl = lots.filter((l) => l.productId !== productId);
    setProducts(np);
    setLots(nl);
    setSelectedMap((m) => {
      const mm = { ...m };
      delete mm[productId];
      return mm;
    });
    showToast("success", "삭제되었습니다.");
  };

  const onBulkDelete = () => {
    const ids = Object.keys(selectedMap).filter((id) => selectedMap[id]);
    if (ids.length === 0) {
      showToast("warning", "선택된 품목이 없습니다.");
      return;
    }
    if (!confirm(`선택한 ${ids.length}개 품목을 삭제할까요? (관련 입고 기록 포함)`)) return;
    const np = products.filter((p) => !ids.includes(p.id));
    const nl = lots.filter((l) => !ids.includes(l.productId));
    setProducts(np);
    setLots(nl);
    setSelectedMap({});
    showToast("success", "삭제되었습니다.");
  };

  return (
    <div className="space-y-3 relative">
      {/* 토스트 */}
      <Toast open={toast.open} type={toast.type} message={toast.message} />

      {/* 검색 + 추가 + 일괄삭제(오른쪽) */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상품명, 품번 등 검색..."
          className="flex-1 border rounded-xl px-3 py-2 bg-white"
        />
        <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">
          + 품목 추가
        </button>
        <button
          onClick={onBulkDelete}
          className={`px-4 py-2 rounded-xl ${
            Object.keys(selectedMap).length ? "bg-rose-600 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
          disabled={Object.keys(selectedMap).length === 0}
          title="선택한 품목 일괄 삭제"
        >
          일괄 삭제
        </button>
      </div>

      {/* 목록 */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 w-14 pl-3">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} title="전체 선택/해제" />
              </th>
              <th className="py-2 w-20">이미지</th>
              <th className="py-2 w-40">품번</th>
              <th className="py-2">상품명</th>
              <th className="py-2 w-56">브랜드/분류</th>
              <th className="py-2 w-48">사이즈</th>
              <th className="py-2 w-56">메모</th>
              <th className="py-2 w-24 text-right pr-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" className="py-4 text-gray-500 text-center">
                  등록된 품목이 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b">
                {/* 선택 체크박스 */}
                <td className="py-2 pl-3">
                  <input type="checkbox" checked={!!selectedMap[p.id]} onChange={() => toggleOne(p.id)} title="이 품목 선택" />
                </td>

                {/* 이미지: 클릭 시 큰 미리보기 */}
                <td className="py-2">
                  {p.image ? (
                    <img
                      src={p.image}
                      className="w-12 h-12 rounded object-cover cursor-zoom-in border"
                      onClick={() => setPreviewImage(p.image)}
                      title="이미지 크게 보기"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-100 grid place-items-center text-xs text-gray-400">No</div>
                  )}
                </td>

                <td className="py-2">{p.code}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">
                  <div className="font-medium">{p.brand || "-"}</div>
                  <div className="text-xs text-gray-500">{p.category || "-"}</div>
                </td>
                <td className="py-2 truncate">{(p.sizes || []).join(", ")}</td>

                {/* 메모 표시 (길면 잘라서 표시, 클릭 시 전체보기) */}
                <td className="py-2">
                  {p.memo ? (
                    <button
                      className="block w-full text-left truncate hover:underline"
                      title="클릭하여 전체보기"
                      onClick={() => setMemoView(p.memo)}
                    >
                      {p.memo}
                    </button>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                <td className="py-2">
                  <div className="flex items-center gap-2 justify-end pr-1">
                    <button title="수정" onClick={() => setEditTarget(p)} className="p-1 rounded hover:bg-gray-100">
                      ✎
                    </button>
                    <button title="삭제" onClick={() => onDelete(p.id)} className="p-1 rounded hover:bg-gray-100">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 추가 모달 */}
      {showModal && (
        <ProductModal
          onClose={() => setShowModal(false)}
          onCreate={onCreate}
          brands={brands}
          categories={categories}
          notify={showToast}
        />
      )}

      {/* 수정 모달 */}
      {editTarget && (
        <ProductModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdate={onUpdate}
          brands={brands}
          categories={categories}
          notify={showToast}
        />
      )}

      {/* 큰 이미지 미리보기 모달 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="preview-large" className="max-h-[85vh] max-w-[85vw] rounded shadow-2xl" />
        </div>
      )}

      {/* 메모 전체보기 모달 */}
      {memoView && <MemoModal memo={memoView} onClose={() => setMemoView("")} />}
    </div>
  );
}
