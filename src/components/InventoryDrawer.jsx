// src/components/InventoryDrawer.jsx
import React, { useMemo, useRef, useState } from "react";
import { save, LS } from "../lib/storage.js";

/* ===== 공용 유틸 ===== */
const fmt = (n) => (Number(n) || 0).toLocaleString();
const ymd = (iso) => (iso || "").slice(0, 10);
const ymdhms = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mi}:${ss}`;
};

/* 부드러운 아코디언 */
function Collapse({ open, children }) {
  return (
    <div
      className={`transition-all duration-300 ease-out overflow-hidden ${
        open ? "opacity-100" : "opacity-0"
      }`}
      style={{ maxHeight: open ? "1000px" : "0px" }}
    >
      {children}
    </div>
  );
}

/* 점선 테두리 일괄 적용 (Excel) */
function applyDottedBorders(ws, lastRow, lastCol) {
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: "dotted", color: { argb: "FF999999" } },
        bottom: { style: "dotted", color: { argb: "FF999999" } },
        left: { style: "dotted", color: { argb: "FF999999" } },
        right: { style: "dotted", color: { argb: "FF999999" } },
      };
    }
  }
}

/**
 * 실시간 재고 드로어
 * props:
 *  - open, setOpen
 *  - aggregated: computeAggregated(products, lots) 결과
 *  - lots, setLots
 *  - brands, categories (필터용; brands: [{name}], categories: [{name, children?:[]}] )
 */
export default function InventoryDrawer({
  open,
  setOpen,
  aggregated,
  lots,
  setLots,
  brands = [],
  categories = [],
}) {
  /* 펼침 상태 */
  const [openProduct, setOpenProduct] = useState({});
  const [openSize, setOpenSize] = useState({});

  /* 미리보기 */
  const [previewImage, setPreviewImage] = useState(null);

  /* 검색 & 필터 */
  const [q, setQ] = useState("");

  // 드롭다운(select) 값: "ALL" = 전체
  const brandOptions = useMemo(
    () => ["ALL", ...brands.map((b) => b.name).filter(Boolean)],
    [brands]
  );
  const majorOptions = useMemo(() => {
    const s = new Set();
    categories.forEach((c) => s.add(c.name));
    return ["ALL", ...Array.from(s)];
  }, [categories]);

  const [brandSel, setBrandSel] = useState("ALL");
  const [majorSel, setMajorSel] = useState("ALL");

  // 사이즈 전체 펼침
  const [expandAll, setExpandAll] = useState(false);

  // 행 hover 색상 설정
  const hoverProduct = "hover:bg-[#d5d5d5]";
  const hoverSize = "hover:bg-[#bfe3fd]";
  const hoverLot = "hover:bg-[#fdbfbf]";

  // 중/소분류 고정 배경색
  const bgProduct = "bg-[#eaeaea]"; // 파스텔 블루
  const bgSize = "bg-[#e3f4ff]"; // 파스텔 블루
  const bgLot = "bg-[#f9dbdb]"; // 파스텔 퍼플

  // 필터링
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (aggregated || []).filter((p) => {
      // 검색(품번/상품명)
      if (t) {
        const hay = `${p.code || ""} ${p.name || ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      // 브랜드
      if (brandSel !== "ALL") {
        if ((p.brand || "") !== brandSel) return false;
      }
      // 대분류
      if (majorSel !== "ALL") {
        const major = (p.category || "").split(">").map((s) => s.trim())[0] || "";
        if (major !== majorSel) return false;
      }
      return true;
    });
  }, [aggregated, q, brandSel, majorSel]);

  // 토글들
  const toggleProduct = (pid) =>
    setOpenProduct((s) => ({ ...s, [pid]: !s[pid] }));

  const toggleSize = (pid, size) => {
    const key = `${pid}|${size}`;
    setOpenSize((s) => ({ ...s, [key]: !s[key] }));
    // qty 0 lot 정리
    const removeIds = lots
      .filter(
        (l) => l.productId === pid && String(l.size) === String(size) && Number(l.qty) <= 0
      )
      .map((l) => l.id);
    if (removeIds.length) {
      const next = lots.filter((l) => !removeIds.includes(l.id));
      setLots(next);
      save(LS.LOTS, next);
    }
  };

  const toggleExpandAll = () => {
    const next = !expandAll;
    setExpandAll(next);
    if (next) {
      const all = {};
      filtered.forEach((p) => (all[p.id] = true));
      setOpenProduct(all);
    } else {
      setOpenProduct({});
      setOpenSize({});
    }
  };

  // 총 재고 수량/가치
  const { totalQty, totalValue } = useMemo(() => {
    let qty = 0;
    let value = 0;
    for (const l of lots || []) {
      const qn = Number(l.qty) || 0;
      if (qn > 0) {
        qty += qn;
        value += qn * (Number(l.purchasePrice) || 0);
      }
    }
    return { totalQty: qty, totalValue: value };
  }, [lots]);

  /* ===== 엑셀 다운로드 ===== */
  const downloading = useRef(false);

  async function handleDownloadExcel() {
    if (downloading.current) return;
    downloading.current = true;
    try {
      const ExcelNS = (await import("exceljs"));
      const ExcelJS = ExcelNS.default || ExcelNS;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("재고");

      const headers = [
        "레벨",
        "품번",
        "상품명",
        "브랜드",
        "대분류",
        "소분류",
        "사이즈",
        "입고일",
        "현재수량",
        "평균매입가",
        "개별매입가(LOT)",
      ];
      ws.addRow(headers);

      // 틀 고정 + 헤더 스타일
      ws.views = [{ state: "frozen", ySplit: 1 }];
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF5B9BD5" },
        };
      });

      // 데이터 작성
      (filtered || []).forEach((p) => {
        const [major, minor] = String(p.category || "")
          .split(">")
          .map((s) => s.trim());

        // product 레벨
        const productRow = ws.addRow([
          "product",
          p.code || "",
          p.name || "",
          p.brand || "",
          major || "",
          minor || "",
          "",
          "",
          Number(p.qty) || 0,
          Math.round(Number(p.avg) || 0),
          Math.round((Number(p.qty) || 0) * (Number(p.avg) || 0)),
        ]);
        productRow.eachCell((cell, col) => {
          cell.font = {
            name: "맑은 고딕",
            size: 16,
            bold: true,
            color: col === 11 ? { argb: "FFFF0000" } : undefined, // 총 가격 빨간색
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        // size 레벨
        const sizes = Object.values(p.sizes || {});
        sizes.forEach((s) => {
          const sizeRow = ws.addRow([
            "size",
            p.code || "",
            p.name || "",
            p.brand || "",
            major || "",
            minor || "",
            s.size || "",
            "",
            Number(s.qty) || 0,
            Math.round(Number(s.avg) || 0),
            "",
          ]);
          sizeRow.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE2EFDA" },
            };
            cell.alignment = { vertical: "middle", horizontal: "center" };
          });

          // lot 레벨 (입고일 시:분:초 포함)
          (s.lots || [])
            .filter((l) => Number(l.qty) > 0)
            .forEach((l) => {
              const lotRow = ws.addRow([
                "lot",
                p.code || "",
                p.name || "",
                p.brand || "",
                major || "",
                minor || "",
                s.size || "",
                ymdhms(l.receivedAt),
                Number(l.qty) || 0,
                "",
                Number(l.purchasePrice) || 0,
              ]);
              lotRow.eachCell((cell) => {
                cell.alignment = { vertical: "middle", horizontal: "center" };
              });
            });
        });
      });

      // 숫자서식
      ws.getColumn(10).numFmt = "#,##0"; // 평균매입가
      ws.getColumn(11).numFmt = "#,##0"; // 개별매입가(LOT)/총가격

      // 점선 테두리
      const lastRow = ws.lastRow?.number || 1;
      const lastCol = headers.length;
      applyDottedBorders(ws, lastRow, lastCol);

      // 모든 데이터 작성 후 — 열너비 자동 추정(강화판)
      function humanLenFromCell(cell, columnIndex) {
        const v = cell.value;
        if ((columnIndex === 10 || columnIndex === 11) && typeof v === "number") {
          try {
            return new Intl.NumberFormat().format(v).length;
          } catch {
            return String(v).length;
          }
        }
        if (columnIndex === 8) {
          if (v instanceof Date) return 19;
          const s = typeof v === "string" ? v : String(v ?? "");
          return Math.max(s.length, 19);
        }
        if (v == null) return 0;
        if (typeof v === "object") {
          const s = (v.text || (v.richText?.map((t) => t.text).join("")) || "").toString();
          return s.length;
        }
        return String(v).length;
      }

      const defaultFontSize = 11;
      for (let c = 1; c <= lastCol; c++) {
        let maxVisual = headers[c - 1].length;
        ws.eachRow({ includeEmpty: true }, (row) => {
          const cell = row.getCell(c);
          const baseLen = humanLenFromCell(cell, c);
          const fs = cell.font?.size ? Number(cell.font.size) : defaultFontSize;
          const factor = Math.max(1, fs / defaultFontSize);
          const visualLen = Math.ceil(baseLen * factor);
          if (visualLen > maxVisual) maxVisual = visualLen;
        });
        const padding = 4;
        ws.getColumn(c).width = Math.min(Math.max(10, maxVisual + padding), 60);
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `재고_${ymd(new Date().toISOString())}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("엑셀 내보내기 중 오류가 발생했습니다.");
    } finally {
      downloading.current = false;
    }
  }

  /* 핸들 라벨 */
  const handleLabel = open ? (
    <div className="leading-4 text-indigo-600 text-sm text-center">
      <div>▷ 재고</div>
      <div className="text-xs text-gray-500">접음</div>
    </div>
  ) : (
    <div className="leading-4 text-indigo-600 text-sm text-center">
      <div>◁ 재고</div>
      <div className="text-xs text-gray-500">펼침</div>
    </div>
  );

  return (
    <>
      {/* 우측 핸들 버튼 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-1/2 -translate-y-1/2 right-0 z-40 px-3 py-2 rounded-l-xl shadow bg-white border"
      >
        {handleLabel}
      </button>

      {/* 패널 */}
      <aside
        className={`fixed top-0 right-0 bottom-0 bg-white shadow-2xl z-30 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "min(960px, 50vw)", minWidth: "420px", maxWidth: "960px" }}
        role="complementary"
      >
        <div className="h-full flex flex-col">
          {/* 헤더 */}
          <div className="p-4 border-b">
            <h3 className="font-semibold">실시간 재고</h3>
          </div>

          {/* 상단 컨트롤: 검색 + 셀렉트 필터 */}
          <div className="p-3 border-b space-y-3">
            {/* 검색 & 필터 1줄 */}
            <div className="flex gap-2 items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="품번 또는 상품명 검색"
                className="flex-1 border rounded-xl px-3 py-2 bg-white"
              />

              {/* 브랜드 select (버튼 아님, 자체 드롭다운) */}
              <select
                className="border rounded-xl px-3 py-2 bg-white"
                value={brandSel}
                onChange={(e) => setBrandSel(e.target.value)}
                title="브랜드 필터"
              >
                {brandOptions.map((name) => (
                  <option key={name} value={name}>
                    {name === "ALL" ? "브랜드 전체" : name}
                  </option>
                ))}
              </select>

              {/* 분류(대분류) select */}
              <select
                className="border rounded-xl px-3 py-2 bg-white"
                value={majorSel}
                onChange={(e) => setMajorSel(e.target.value)}
                title="분류(대분류) 필터"
              >
                {majorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name === "ALL" ? "분류 전체" : name}
                  </option>
                ))}
              </select>
            </div>

            {/* 총 재고 수량/가치 + 버튼들 (같은 줄) */}
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold">
                총 재고 수량: <span className="text-blue-600">{fmt(totalQty)}</span>개&nbsp;&nbsp;
                총 재고 가치: <span className="text-blue-600">{fmt(totalValue)}</span>원
              </div>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-2 rounded-xl border ${
                    expandAll ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
                  }`}
                  onClick={toggleExpandAll}
                  title="사이즈 펼침/접힘"
                >
                  사이즈 {expandAll ? "접힘" : "펼침"}
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="px-3 py-2 rounded-xl border bg-blue-600 text-white"
                  title="현재 보기 엑셀 다운로드"
                >
                  엑셀 다운로드
                </button>
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div className="p-3 overflow-y-auto">
            {/* 헤더 (중앙 정렬) */}
            <div className="grid grid-cols-[64px,140px,1fr,140px,200px,90px,120px] text-sm text-gray-600 border-b pb-2 font-medium text-center">
              <div>이미지</div>
              <div>품번</div>
              <div>상품명 / 사이즈</div>
              <div>브랜드</div>
              <div>분류</div>
              <div>수량</div>
              <div>평균매입가</div>
            </div>

            {/* 데이터 */}
            <div>
              {(filtered || []).map((p) => {
                const major = (p.category || "").split(">").map((s) => s.trim())[0] || "";
                const minor =
                  (p.category || "").split(">").map((s) => s.trim())[1] || "";
                const openP = !!openProduct[p.id];

                return (
                  <React.Fragment key={`p-${p.id}`}>
                    {/* 대분류(상품행) — bold + hover */}
                    <div
                      className={`grid grid-cols-[64px,140px,1fr,140px,200px,90px,120px] items-center border-b cursor-pointer ${bgProduct} ${hoverProduct} text-center`}
                      onClick={() => toggleProduct(p.id)}
                    >
                      <div
                        className="py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.image) setPreviewImage(p.image);
                        }}
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            className="w-12 h-12 rounded object-cover cursor-zoom-in border mx-auto"
                            alt="thumb"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 grid place-items-center text-xs text-gray-400 mx-auto">
                            No
                          </div>
                        )}
                      </div>
                      <div className="py-2 font-bold">{p.code}</div>
                      <div className="py-2 font-bold">{p.name}</div>
                      <div className="py-2">{p.brand || "-"}</div>
                      <div className="py-2">
                        <div className="font-medium">{major || "-"}</div>
                        {minor && <div className="text-xs text-gray-500">{minor}</div>}
                      </div>
                      <div className="py-2 font-bold truncate">{fmt(p.qty)}</div>
                      <div className="py-2 font-bold truncate">
                        {p.avg ? Math.round(p.avg).toLocaleString() : "-"}
                      </div>
                    </div>

                    {/* 중분류(사이즈 그룹) */}
                    <Collapse open={openP}>
                      {Object.values(p.sizes || {}).map((s) => {
                        const key = `${p.id}|${s.size}`;
                        const openS = !!openSize[key];
                        return (
                          <React.Fragment key={`s-${p.id}-${s.size}`}>
                            {/* 중분류(사이즈) — 고정 배경 + hover + 중앙정렬 */}
                            <div
                              className={`grid grid-cols-[64px,140px,1fr,140px,200px,90px,120px] items-center border-b cursor-pointer ${bgSize} ${hoverSize} text-center`}
                              onClick={() => toggleSize(p.id, s.size)}
                              title="클릭하여 입고 LOT 펼침/접힘"
                            >
                              <div className="py-2"></div>
                              <div className="py-2"></div>
                              <div className="py-2">
                                <span className="font-medium">{s.size}</span>
                              </div>
                              <div className="py-2">—</div>
                              <div className="py-2">—</div>
                              <div className="py-2">{fmt(s.qty)}</div>
                              <div className="py-2">
                                {s.avg ? Math.round(s.avg).toLocaleString() : "-"}
                              </div>
                            </div>

                            {/* 소분류(LOT) — 고정 배경 + hover + 중앙정렬 / 입고일 시:분:초 */}
                            <Collapse open={openS}>
                              {(s.lots || [])
                                .filter((l) => Number(l.qty) > 0)
                                .map((l) => (
                                  <div
                                    key={`l-${l.id}`}
                                    className={`grid grid-cols-[64px,140px,1fr,140px,200px,90px,120px] items-center border-b text-xs ${bgLot} ${hoverLot} text-center`}
                                  >
                                    <div className="py-2"></div>
                                    <div className="py-2"></div>
                                    <div className="py-2">{ymdhms(l.receivedAt)}</div>
                                    <div className="py-2">—</div>
                                    <div className="py-2">—</div>
                                    <div className="py-2">{fmt(l.qty)}</div>
                                    <div className="py-2">{fmt(l.purchasePrice)}</div>
                                  </div>
                                ))}
                            </Collapse>
                          </React.Fragment>
                        );
                      })}
                    </Collapse>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* 이미지 미리보기 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="preview"
            className="max-h-[85vh] max-w-[85vw] rounded shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
