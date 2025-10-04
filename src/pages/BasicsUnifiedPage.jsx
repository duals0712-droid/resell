// src/pages/BasicsUnifiedPage.jsx
import React from "react";
import PartnersPage from "./PartnersPage.jsx";
import PaymentsPage from "./PaymentsPage.jsx";
import CategoriesPage from "./CategoriesPage.jsx";
import CouriersPage from "./CouriersPage.jsx";

/** 칸을 확실히 구분한 통합 페이지
 * 순서: 거래처 → 결제수단 → 분류 → 택배
 * 각 섹션은 자체 컴포넌트를 그대로 사용하며, 시각적 구분을 위해 카드/구분선/앵커를 제공합니다.
 */
export default function BasicsUnifiedPage({ 
  partners, setPartners,
  payments, setPayments,
  categories, setCategories,
  brands, setBrands,
  couriers, setCouriers,
}) {
  return (
    <div className="space-y-8">
      {/* 섹션 점프(고정) */}
      <nav className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-white/80 backdrop-blur border-b">
        <ol className="flex flex-wrap gap-3 text-sm text-gray-600">
          <li><a href="#sec-partners" className="px-2 py-1 rounded-md hover:bg-gray-100">거래처</a></li>
          <li>›</li>
          <li><a href="#sec-payments" className="px-2 py-1 rounded-md hover:bg-gray-100">결제수단</a></li>
          <li>›</li>
          <li><a href="#sec-categories" className="px-2 py-1 rounded-md hover:bg-gray-100">분류</a></li>
          <li>›</li>
          <li><a href="#sec-couriers" className="px-2 py-1 rounded-md hover:bg-gray-100">택배</a></li>
        </ol>
      </nav>

      <SectionCard id="sec-partners" title="거래처 관리">
        <PartnersPage partners={partners} setPartners={setPartners} />
      </SectionCard>

      <SectionDivider />

      <SectionCard id="sec-payments" title="결제수단 관리">
        <PaymentsPage payments={payments} setPayments={setPayments} />
      </SectionCard>

      <SectionDivider />

      <SectionCard id="sec-categories" title="분류 관리">
        <CategoriesPage 
          categories={categories} 
          setCategories={setCategories} 
          brands={brands} 
          setBrands={setBrands} 
        />
      </SectionCard>

      <SectionDivider />

      <SectionCard id="sec-couriers" title="택배 관리">
        <CouriersPage couriers={couriers} setCouriers={setCouriers} />
      </SectionCard>
    </div>
  );
}

function SectionCard({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <a href="#top" className="text-xs text-gray-500 hover:underline">맨 위로</a>
      </header>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
        {children}
      </div>
    </section>
  );
}

function SectionDivider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />;
}
