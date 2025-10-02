// src/components/Sidebar.jsx
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { LS } from "../lib/storage.js";

/** 부드러운 아코디언 */
function Collapse({ open, children }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${
        open ? "opacity-100" : "opacity-0"
      }`}
      style={{ maxHeight: open ? "700px" : "0px" }}
      aria-hidden={!open}
    >
      {children}
    </div>
  );
}

/** 공통 네비 아이템 (중분류/단일 버튼) */
function NavItem({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-2 rounded-lg text-sm",
        "transition-colors duration-200",
        active ? "bg-blue-600 text-white shadow-sm"
               : "text-gray-800 hover:bg-[#ddddddff]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/** 대분류 헤더 */
function GroupHeader({ label, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={[
        "w-full flex items-center justify-between px-3 py-2 rounded-lg",
        "font-semibold text-gray-900",
        "transition-colors duration-200 hover:bg-[#e4edeeff]",
      ].join(" ")}
      aria-expanded={open}
      aria-label={`${label} 펼치기/접기`}
    >
      <span>{label}</span>
      <span
        className={`text-gray-500 transition-transform duration-300 ${
          open ? "rotate-180" : "rotate-0"
        }`}
      >
        ▼
      </span>
    </button>
  );
}

/** 삭제 확인 모달 */
function ConfirmDeleteModal({ onClose, onConfirm }) {
  const [text, setText] = useState("");
  const canDelete = text.trim() === "삭제";

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* 패널 */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-bold">모든 데이터 삭제</h3>
          </div>

          <div className="p-4 space-y-3 text-sm">
            <p className="text-gray-700">
              아래 입력칸에 <b>삭제</b> 라고 정확히 입력해야 삭제가 가능합니다.
            </p>
            <p className="text-rose-600">
              이 작업은 되돌릴 수 없습니다. 기초관리, 상품관리, 장부/통계의 <b>모든 데이터가 즉시 삭제</b>됩니다.
            </p>
            <input
              className="w-full border rounded-xl px-3 py-2"
              placeholder="삭제"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2">
            <button className="px-4 py-2 rounded-xl border" onClick={onClose}>
              취소
            </button>
            <button
              className={`px-4 py-2 rounded-xl text-white ${
                canDelete ? "bg-red-600 hover:bg-red-700" : "bg-red-300 cursor-not-allowed"
              }`}
              onClick={() => canDelete && onConfirm()}
              disabled={!canDelete}
            >
              데이터 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 실제 로컬스토리지 데이터 전체 삭제 */
function wipeAllLocalData() {
  try {
    // 프로젝트에서 사용하는 주요 키들
    const mainKeys = Object.values(LS || {});
    // 부가 키(우선출고/수기장부/초기수량락/LOT 시퀀스 등)
    const extraKeys = [
      "res_outlater_v1",
      "res_book_manual_v1",
      "res_book_initial_qty_v1",
      "res_lot_seq_v1",
    ];
    // 프로젝트 접두어 스윕
    const prefixSweep = Object.keys(localStorage).filter((k) => /^res_/i.test(k));

    const all = Array.from(new Set([...mainKeys, ...extraKeys, ...prefixSweep]));
    all.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.error("데이터 삭제 중 오류:", e);
  }
}

export default function Sidebar({ current, setCurrent }) {
  // 대분류 펼침 상태 (기본 접힘)
  const [openGroup, setOpenGroup] = useState({
    base: true,
    product: true,
    ledger: true,
  });
  const toggle = (k) => setOpenGroup((s) => ({ ...s, [k]: !s[k] }));

  // 삭제 모달
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    // 좌측만 독립 스크롤: sticky + h-screen + 내부 영역 overflow-y-auto
    <aside className="sticky top-0 h-screen border-r bg-white overflow-hidden" aria-label="왼쪽 사이드바">
      <div className="h-full flex flex-col">
        {/* 스크롤되는 메뉴 영역 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">

          {/* 기초 관리 */}
          <div>
            <GroupHeader
              label="⛏️　기초 관리"
              open={openGroup.base}
              onToggle={() => toggle("base")}
            />
            <Collapse open={openGroup.base}>
              <div className="pl-3 pt-2 space-y-1">
                <NavItem
                  label="거래처 관리"
                  active={current === "partners"}
                  onClick={() => setCurrent("partners")}
                />
                <NavItem
                  label="결제수단 관리"
                  active={current === "payments"}
                  onClick={() => setCurrent("payments")}
                />
                <NavItem
                  label="분류 관리"
                  active={current === "categories"}
                  onClick={() => setCurrent("categories")}
                />
                <NavItem
                  label="택배 관리"
                  active={current === "courier"}
                  onClick={() => setCurrent("courier")}
                />
              </div>
            </Collapse>
          </div>

          {/* 상품 관리 */}
          <div>
            <GroupHeader
              label="📦　상품 관리"
              open={openGroup.product}
              onToggle={() => toggle("product")}
            />
            <Collapse open={openGroup.product}>
              <div className="pl-3 pt-2 space-y-1">
                <NavItem
                  label="품목 관리"
                  active={current === "products"}
                  onClick={() => setCurrent("products")}
                />
                <NavItem
                  label="입출고 등록"
                  active={current === "io-register"}
                  onClick={() => setCurrent("io-register")}
                />
                <NavItem
                  label="입출고 내역"
                  active={current === "io-history"}
                  onClick={() => setCurrent("io-history")}
                />
                <NavItem
                  label="우선출고 리스트"
                  active={current === "out-later-list"}
                  onClick={() => setCurrent("out-later-list")}
                />
                <NavItem
                  label="반품/교환 관리"
                  active={current === "returns"}
                  onClick={() => setCurrent("returns")}
                />
              </div>
            </Collapse>
          </div>

          {/* 장부 통계 */}
          <div>
            <GroupHeader
              label="📋　장부 통계"
              open={openGroup.ledger}
              onToggle={() => toggle("ledger")}
            />
            <Collapse open={openGroup.ledger}>
              <div className="pl-3 pt-2 space-y-1">
                <NavItem
                  label="통합 장부"
                  active={current === "ledger"}
                  onClick={() => setCurrent("ledger")}
                />
                <NavItem
                  label="부가세 신고 금액 예상"
                  active={current === "stats"}
                  onClick={() => setCurrent("stats")}
                />
              </div>
            </Collapse>
          </div>
        </div>

        {/* 하단 고정: 모든 데이터 삭제 버튼 */}
        <div className="p-3 border-t">
          <button
            className="w-full px-3 py-2 rounded-xl font-bold text-white
                       bg-[#7b1e36] hover:opacity-95 active:opacity-90 transition"
            onClick={() => setConfirmOpen(true)}
          >
            모든 데이터 삭제
          </button>
        </div>
      </div>

      {confirmOpen &&
        createPortal(
          <ConfirmDeleteModal
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              wipeAllLocalData();
              window.location.reload();
            }}
          />,
          document.body
        )
      }
    </aside>
  );
}
