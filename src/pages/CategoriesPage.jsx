// src/pages/CategoriesPage.jsx
import React from "react";
import { uid } from "../lib/uid.js";
export default function CategoriesPage({ categories, setCategories, brands, setBrands }) {
  // 입력 상태
  const [newMajor, setNewMajor] = React.useState("");
  const [firstMinor, setFirstMinor] = React.useState("");
  const [minorInputs, setMinorInputs] = React.useState({}); // { [majorId]: '' }

  // ===== 브랜드 입력 =====
  const [brandInput, setBrandInput] = React.useState("");
  const addBrand = () => {
    const name = brandInput.trim();
    if (!name) return;
    const next = [...brands, { id: uid(), name }];
    setBrands(next);
    setBrandInput("");
  };
  const addBrandByEnter = (e) => {
    if (e.key === "Enter") addBrand();
  };
  const removeBrand = (id) => {
    const next = brands.filter((b) => b.id !== id);
    setBrands(next);
    };

  // ===== 대분류 추가 =====
  const addMajor = () => {
    const mj = newMajor.trim();
    if (!mj) return;
    const minor = firstMinor.trim();
    const node = {
      id: uid(),
      name: mj,
      children: minor ? [{ id: uid(), name: minor }] : [],
    };
    const next = [...categories, node];
    setCategories(next);
    setNewMajor("");
    setFirstMinor("");
  };

  // ===== 대분류/소분류 수정 =====
  const renameMajor = (id) => {
    const cur = categories.find((c) => c.id === id);
    const name = prompt("대분류 이름 변경", cur?.name || "");
    if (name === null) return;
    const next = categories.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c));
    setCategories(next);
    };
  const renameMinor = (mid, cid) => {
    const curM = categories.find((c) => c.id === mid);
    const cur = curM?.children?.find((x) => x.id === cid);
    const name = prompt("소분류 이름 변경", cur?.name || "");
    if (name === null) return;
    const next = categories.map((c) => {
      if (c.id !== mid) return c;
      const kids = (c.children || []).map((k) => (k.id === cid ? { ...k, name: name.trim() || k.name } : k));
      return { ...c, children: kids };
    });
    setCategories(next);
    };

  // ===== 삭제 =====
  const removeMajor = (id) => {
    if (!confirm("이 대분류와 소분류가 모두 삭제됩니다. 계속할까요?")) return;
    const next = categories.filter((c) => c.id !== id);
    setCategories(next);
    };
  const removeMinor = (mid, cid) => {
    const next = categories.map((c) => {
      if (c.id !== mid) return c;
      return { ...c, children: (c.children || []).filter((k) => k.id !== cid) };
    });
    setCategories(next);
    };

  // ===== 소분류 입력(Enter로 추가) =====
  const addMinorEnter = (e, mid) => {
    if (e.key !== "Enter") return;
    const name = (minorInputs[mid] || "").trim();
    if (!name) return;
    const next = categories.map((c) => {
      if (c.id !== mid) return c;
      const kids = [...(c.children || []), { id: uid(), name }];
      return { ...c, children: kids };
    });
    setCategories(next);
    setMinorInputs((s) => ({ ...s, [mid]: "" }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">분류 및 브랜드 관리</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 분류 관리 */}
        <div className="p-6 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">분류 관리</h3>
          </div>

          <div className="space-y-2 mb-4">
            <input
              value={newMajor}
              onChange={(e) => setNewMajor(e.target.value)}
              placeholder="새 대분류 이름 (예: 신발)"
              className="w-full border rounded-xl px-3 py-2"
            />
            <input
              value={firstMinor}
              onChange={(e) => setFirstMinor(e.target.value)}
              placeholder="첫 소분류 이름 (예: 운동화)"
              className="w-full border rounded-xl px-3 py-2"
            />
            <button onClick={addMajor} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">
              새 대분류 추가
            </button>
          </div>

          {/* 대분류 목록 */}
          <div className="space-y-2">
            {categories.length === 0 && <div className="text-sm text-gray-500">등록된 분류가 없습니다.</div>}
            {categories.map((mj) => (
              <details key={mj.id} className="rounded border">
                <summary className="flex items-center justify-between px-3 py-2 cursor-pointer">
                  <span className="font-medium">{mj.name}</span>
                  <span className="flex items-center gap-2">
                    <button
                      title="이름 변경"
                      onClick={(e) => {
                        e.preventDefault();
                        renameMajor(mj.id);
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      ✎
                    </button>
                    <button
                      title="삭제"
                      onClick={(e) => {
                        e.preventDefault();
                        removeMajor(mj.id);
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      🗑️
                    </button>
                  </span>
                </summary>
                <div className="p-3 pt-0 space-y-2">
                  {(mj.children || []).map((mi) => (
                    <div key={mi.id} className="flex items-center justify-between rounded bg-gray-50 px-3 py-2">
                      <span>ㄴ {mi.name}</span>
                      <span className="flex items-center gap-2">
                        <button
                          title="이름 변경"
                          onClick={() => renameMinor(mj.id, mi.id)}
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          ✎
                        </button>
                        <button
                          title="삭제"
                          onClick={() => removeMinor(mj.id, mi.id)}
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          🗑️
                        </button>
                      </span>
                    </div>
                  ))}
                  <input
                    value={minorInputs[mj.id] || ""}
                    onChange={(e) => setMinorInputs((s) => ({ ...s, [mj.id]: e.target.value }))}
                    onKeyDown={(e) => addMinorEnter(e, mj.id)}
                    placeholder="새 소분류 추가 후 Enter"
                    className="w-full border rounded-xl px-3 py-2"
                  />
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* 브랜드 관리 */}
        <div className="p-6 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">브랜드 관리</h3>
          </div>

          <input
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            onKeyDown={addBrandByEnter}
            placeholder="새 브랜드 추가 후 Enter"
            className="w-full border rounded-xl px-3 py-2 mb-3"
          />

          <div className="space-y-2">
            {brands.length === 0 && <div className="text-sm text-gray-500">등록된 브랜드가 없습니다.</div>}
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span className="font-medium">{b.name}</span>
                <button title="삭제" onClick={() => removeBrand(b.id)} className="p-1 rounded hover:bg-gray-100">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
