// src/pages/IoHistoryPage.jsx
import React, { useMemo, useRef, useState } from "react";

/* 유틸 */
const fmt = (n) => (Number(n) || 0).toLocaleString();

// 로컬(사용자 PC) 기준 YYYY-MM-DD
function ymdLocal(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseIsoSafe(s) {
  const t = Date.parse(s || 0);
  return Number.isFinite(t) ? new Date(t) : new Date(0);
}
function ymd(iso) {
  return ymdLocal(parseIsoSafe(iso));
}

/* 상품 검색 드롭다운
   - 목록: 이미지 + 이름 (코드)
   - 클릭 시 input에 '코드'만 넣기
   - 입력값은 자유롭게 지울 수 있음
*/
function ProductPicker({ products, value, onChange, onPick }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const timer = useRef(null);

  React.useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const list = useMemo(() => {
    const t = (value || "").trim().toLowerCase();
    let arr = products || [];
    if (t) {
      arr = arr.filter(
        (p) =>
          (p.code || "").toLowerCase().includes(t) ||
          (p.name || "").toLowerCase().includes(t)
      );
    }
    return arr.slice(0, 200);
  }, [products, value]);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 160);
  };

  return (
    <div
      className="relative w-full"
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="품번 또는 상품명으로 검색"
        className="w-full border rounded-xl px-3 py-2 bg-white"
        autoComplete="off"
      />
      {open && (
        <div className="absolute left-0 right-0 top-full -translate-y-px z-20 bg-white border rounded-xl shadow-lg max-h-72 overflow-auto">
          {list.length === 0 && (
            <div className="p-3 text-sm text-gray-500">검색결과 없음</div>
          )}
          {list.map((p) => (
            <div
              key={p.id}
              className="p-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3"
              onMouseDown={(e) => {
                e.preventDefault();
                // 코드만 입력창에 넣기
                onChange(p.code || "");
                onPick && onPick(p);
                setOpen(false);
              }}
            >
              {p.image ? (
                <img src={p.image} className="w-9 h-9 rounded object-cover border" />
              ) : (
                <div className="w-9 h-9 rounded bg-gray-100" />
              )}
              <div className="flex-1 text-sm">
                <div className="font-medium">{p.name}</div>
                <div className="text-gray-500">{p.code}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* 네이티브 셀렉트: '브랜드 전체' / '분류 전체'가 옵션 중 하나 */
function SelectFilter({ items = [], value, onChange, allLabel }) {
  return (
    <select
      className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 transition-colors duration-150"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{allLabel || "전체"}</option>
      {items.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

/* 메인 */
export default function IoHistoryPage({
  products = [],
  ioRec = [],
  sales = [],
  partners = [],
  brands = [],
  categories = [],
}) {
  const [preview, setPreview] = useState(null);

  /* 날짜: 기본 '최근 1년 ~ 오늘(로컬)' */
  const today = new Date();
  const oneYearAgo = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate()
  );
  const [from, setFrom] = useState(ymdLocal(oneYearAgo));
  const [to, setTo] = useState(ymdLocal(today)); // 오늘 날짜 보장

  /* 검색어(품번/상품명). 상품 클릭 시 '코드'만 입력 */
  const [query, setQuery] = useState("");

  /* 브랜드/분류(대분류) 단일 선택 */
  const brandNames = useMemo(
    () => brands.map((b) => b.name).filter(Boolean),
    [brands]
  );
  const majorList = useMemo(() => {
    const s = new Set();
    (categories || []).forEach((c) => c?.name && s.add(c.name));
    return Array.from(s);
  }, [categories]);

  const [brandSel, setBrandSel] = useState(""); // '' = 전체
  const [majorSel, setMajorSel] = useState(""); // '' = 전체

  /* 매핑들 */
  const productMap = useMemo(() => {
    const m = new Map();
    (products || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const partnerMap = useMemo(() => {
    const m = new Map();
    (partners || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [partners]);

  // 출고 금액/거래처 매칭: 같은 day|productId|size
  const saleIndex = useMemo(() => {
    const idx = new Map();
    (sales || []).forEach((s) => {
      const key = `${ymd(s.date)}|${s.productId}|${s.size}`;
      if (!idx.has(key)) {
        idx.set(key, {
          unitPrice: Number(s.unitPrice) || 0,
          partnerId: s.partnerId,
        });
      }
    });
    return idx;
  }, [sales]);

  /* 필터링 */
  const rows = useMemo(() => {
    const fromTime = Date.parse(from + "T00:00:00");
    const toTime = Date.parse(to + "T23:59:59");

    const t = (query || "").trim().toLowerCase();

    return (ioRec || [])
      .filter((r) => {
        // 기간
        const tt = Date.parse(r.date || 0) || 0;
        if (!(fromTime <= tt && tt <= toTime)) return false;

        const p = productMap.get(r.productId) || {};
        const code = (r.code || p.code || "").toLowerCase();
        const name = (r.name || p.name || "").toLowerCase();

        // 검색: 품번/상품명 부분일치
        if (t) {
          if (!(code.includes(t) || name.includes(t))) return false;
        }

        // 브랜드 단일 선택
        if (brandSel && (p.brand || "") !== brandSel) return false;

        // 대분류 단일 선택
        const major = String(p.category || "").split(">")[0].trim();
        if (majorSel && major !== majorSel) return false;

        return true;
      })
      .map((r) => {
        const p = productMap.get(r.productId) || {};
        const img = p.image || "";
        const brand = p.brand || "-";
        const [major, minor] = String(p.category || "")
          .split(">")
          .map((s) => s.trim());

        const base = {
          id: r.id,
          date: r.date,
          code: r.code || p.code || "",
          name: r.name || p.name || "",
          image: img,
          brand,
          categoryMajor: major || "-",
          categoryMinor: minor || "",
          size: r.size,
          qty: Number(r.qty) || 0,
        };

        if (r.type === "입고") {
          // 입고 단가
          const amount = Number(r.unitPurchase) || 0;
          return { ...base, mode: "입고", partnerName: "-", unitAmount: amount };
        }

        if (r.type === "출고") {
          const isOutLater = (r.memo || "") === "우선출고";
          if (isOutLater) {
            return { ...base, mode: "우선출고", partnerName: "-", unitAmount: 0 };
          }
          const key = `${ymd(r.date)}|${r.productId}|${r.size}`;
          const found = saleIndex.get(key);
          const unitAmount = found?.unitPrice || 0;
          const partnerName = found?.partnerId
            ? partnerMap.get(found.partnerId)?.name || "-"
            : "-";
          return { ...base, mode: "출고", partnerName, unitAmount };
        }

        return { ...base, mode: r.type || "-", partnerName: "-", unitAmount: 0 };
      })
      // 최신일자 우선
      .sort((a, b) => {
        const ta = Date.parse(a.date || 0) || 0;
        const tb = Date.parse(b.date || 0) || 0;
        return tb - ta;
      });
  }, [ioRec, from, to, query, brandSel, majorSel, productMap, saleIndex, partnerMap]);

  return (
    <div className="space-y-4">
      {/* 상단 컨트롤 */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* 검색창 (코드/이름 검색) */}
        <div className="min-w-[260px] flex-1">
          <ProductPicker
            products={products}
            value={query}
            onChange={setQuery}
            onPick={() => {}}
          />
        </div>

        {/* 네이티브 드롭다운들(옵션 중 하나로 '전체' 제공) */}
        <SelectFilter
          items={brandNames}
          value={brandSel}
          onChange={setBrandSel}
          allLabel="브랜드 전체"
        />
        <SelectFilter
          items={majorList}
          value={majorSel}
          onChange={setMajorSel}
          allLabel="분류 전체"
        />

        {/* 기간 선택 */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded-xl px-3 py-2"
            title="시작일"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded-xl px-3 py-2"
            title="종료일"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[72px,130px,90px,140px,1fr,100px,200px,100px,80px,110px] text-sm font-medium text-gray-600 border-b px-3 py-2 text-center">
          <div>이미지</div>
          <div>날짜</div>
          <div>구분</div>
          <div>품번</div>
          <div>상품명</div>
          <div>사이즈</div>
          <div>분류</div>
          <div>브랜드</div>
          <div>수량</div>
          <div>금액</div>
        </div>

        {rows.length === 0 && (
          <div className="py-8 text-center text-gray-500 text-sm">내역이 없습니다.</div>
        )}

        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[72px,130px,90px,140px,1fr,100px,200px,100px,80px,110px] items-center border-b px-3 py-2 text-sm text-center"
          >
            <div className="py-1">
              {r.image ? (
                <img
                  src={r.image}
                  className="w-12 h-12 rounded object-cover border cursor-zoom-in mx-auto"
                  onClick={() => setPreview(r.image)}
                  alt="thumb"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-gray-100 mx-auto" />
              )}
            </div>
            <div>{ymd(r.date)}</div>
            <div className="font-semibold">{r.mode}</div>
            <div className="truncate">{r.code}</div>
            <div className="truncate">{r.name}</div>
            <div className="truncate">{r.size}</div>
            <div className="truncate">
              <div className="font-medium">{r.categoryMajor}</div>
              {r.categoryMinor && (
                <div className="text-xs text-gray-500">{r.categoryMinor}</div>
              )}
            </div>
            <div className="truncate">{r.brand}</div>
            <div className="font-medium">{fmt(r.qty)}</div>
            <div className="font-medium">{fmt(r.unitAmount)}</div>
          </div>
        ))}
      </div>

      {/* 이미지 미리보기 */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="preview"
            className="max-h-[85vh] max-w-[85vw] rounded shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
