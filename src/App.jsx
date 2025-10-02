// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import { LS, load, save } from "./lib/storage.js";
import { uid } from "./lib/uid.js";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import PartnersPage from "./pages/PartnersPage.jsx";
import CategoriesPage from "./pages/CategoriesPage.jsx";
import CouriersPage from "./pages/CouriersPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import InOutRegister from "./pages/InOutRegister.jsx";
import OutLaterListPage from "./pages/OutLaterListPage.jsx";
import InventoryDrawer from "./components/InventoryDrawer.jsx";
import { computeAggregated } from "./lib/inventory.js";
import IoHistoryPage from "./pages/IoHistoryPage.jsx";
import ReturnsExchangePage from "./pages/ReturnsExchangePage.jsx";
import LedgerPage from "./pages/LedgerPage.jsx";
import VatEstimatePage from "./pages/VatEstimatePage.jsx";

export default function App() {
  // 전역 상태들
  const [users, setUsers]       = useState(load(LS.USERS, []));
  const [products, setProducts] = useState(load(LS.PRODUCTS, []));
  const [lots, setLots]         = useState(load(LS.LOTS, []));
  const [sales, setSales]       = useState(load(LS.SALES, []));
  const [ioRec, setIoRec]       = useState(load(LS.IOREC, []));
  const [partners, setPartners] = useState(load(LS.PARTNERS, []));
  const [payments, setPayments] = useState(load(LS.PAYMENTS, []));
  const [categoriesState, setCategoriesState] = useState(load(LS.CATEGORIES, []));
  const [brands, setBrands]     = useState(load(LS.BRANDS, []));
  const [couriers, setCouriers] = useState(load(LS.COURIERS, []));

  useEffect(()=>save(LS.USERS, users), [users]);
  useEffect(()=>save(LS.PRODUCTS, products), [products]);
  useEffect(()=>save(LS.LOTS, lots), [lots]);
  useEffect(()=>save(LS.SALES, sales), [sales]);
  useEffect(()=>save(LS.IOREC, ioRec), [ioRec]);
  useEffect(()=>save(LS.PARTNERS, partners), [partners]);
  useEffect(()=>save(LS.PAYMENTS, payments), [payments]);
  useEffect(()=>save(LS.CATEGORIES, categoriesState), [categoriesState]);
  useEffect(()=>save(LS.BRANDS, brands), [brands]);
  useEffect(()=>save(LS.COURIERS, couriers), [couriers]);

  // 데모 관리자 자동 생성
  useEffect(()=>{
    if (!users || users.length===0) {
      const admin = { id: crypto.randomUUID?.() ?? "admin", username:"admin", password:"admin", isPaid:true, isAdmin:true };
      setUsers([admin]); save(LS.USERS, [admin]);
    }
  }, []);

 // 초기 탭을 '통합 장부'로
  const [current, setCurrent] = useState("ledger");

  // 재고 패널: 기본 접힘(false)
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 품목 추가 + 초기 입고 기록 생성(선택)
  const addProduct = (
    code, name, sizesStr, memo, entries = [], image = "", brand = "", category = ""
  ) => {
    const product = {
      id: uid(),
      code,
      name,
      sizes: String(sizesStr || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      memo,
      image: image || "",
      brand: brand || "",
      category: category || "",
    };

    const nextProducts = [...products, product];
    setProducts(nextProducts);
    save(LS.PRODUCTS, nextProducts);

    const newLots = [];
    const newIO = [];
    (entries || []).forEach((e) => {
      const qty = Number(e?.qty || 0);
      const price = Number(e?.price || 0);
      const size = e?.size || "";
      if (qty > 0 && size) {
        const receivedAt = new Date().toISOString();
        const lot = {
          id: uid(),
          productId: product.id,
          size,
          qty,
          purchasePrice: price,
          receivedAt,
          createdAt: new Date().toISOString(),
          createdSeq: (Number(localStorage.getItem("res_lot_seq_v1"))||0)+1,
        };
        localStorage.setItem("res_lot_seq_v1", String(lot.createdSeq));
        newLots.push(lot);

        newIO.push({
          id: uid(),
          type: "입고",
          date: receivedAt,
          productId: product.id,
          code: product.code,
          name: product.name,
          size,
          qty,
          unitPurchase: price,
          totalPurchase: qty * price,
          memo: "",
        });
      }
    });

    if (newLots.length) {
      const nextLots = [...lots, ...newLots];
      setLots(nextLots);
      save(LS.LOTS, nextLots);
    }
    if (newIO.length) {
      const nextIO = [...ioRec, ...newIO];
      setIoRec(nextIO);
      save(LS.IOREC, nextIO);
    }
  };

  // 실시간 재고 집계
  const aggregated = useMemo(() => computeAggregated(products, lots), [products, lots]);

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <Sidebar current={current} setCurrent={setCurrent} />

      <main className="p-6">
        {/* 홈 제거 */}

        {current==='partners' && (
          <div className="p-6 rounded-2xl bg-white/0">
            <PartnersPage partners={partners} setPartners={setPartners} />
          </div>
        )}

        {current==='payments' && (
          <div className="p-6 rounded-2xl bg-white/0">
            <PaymentsPage payments={payments} setPayments={setPayments} />
          </div>
        )}

        {current==='categories' && (
          <div className="p-6 rounded-2xl bg-white/0">
            <CategoriesPage
              categories={categoriesState}
              setCategories={setCategoriesState}
              brands={brands}
              setBrands={setBrands}
            />
          </div>
        )}

        {current==='courier' && (
          <div className="p-6 rounded-2xl bg-white/0">
            <CouriersPage couriers={couriers} setCouriers={setCouriers} />
          </div>
        )}

        {current==='products' && (
          <ProductsPage
            products={products} setProducts={setProducts}
            lots={lots} setLots={setLots}
            addProduct={addProduct}
            brands={brands}
            categories={categoriesState}
          />
        )}

        {current==='io-register' && (
          <InOutRegister
            products={products}
            lots={lots} setLots={setLots}
            sales={sales} setSales={setSales}
            ioRec={ioRec} setIoRec={setIoRec}
            partners={partners}
            payments={payments}
            couriers={couriers}
          />
        )}

{current === "returns" && (
  <ReturnsExchangePage
    products={products}
    partners={partners}
    payments={payments}
    lots={lots}
    setLots={setLots}
    ioRec={ioRec}
    setIoRec={setIoRec}
  />
)}

        {current === "io-history" && (
  <IoHistoryPage
    products={products}
    ioRec={ioRec}
    sales={sales}
    partners={partners}
    brands={brands}
    categories={categoriesState}
  />
)}
{current === "ledger" && (
  <LedgerPage
    products={products}
    partners={partners}
    payments={payments}
    lots={lots}
    sales={sales}
    ioRec={ioRec}
  />
)}

        {current === "stats" && (
          <VatEstimatePage
            products={products}
            partners={partners}
            payments={payments}
            lots={lots}
            sales={sales}
            ioRec={ioRec}
          />
        )}

        {current === "out-later-list" && (
          <OutLaterListPage partners={partners} sales={sales} setSales={setSales} />
        )}
      </main>

      {/* 우측 실시간 재고 패널 (기본 접힘) */}
      <InventoryDrawer
        open={drawerOpen}
        setOpen={setDrawerOpen}
        aggregated={aggregated}
        lots={lots}
        setLots={setLots}
        brands={brands}
        categories={categoriesState}
      />
    </div>
  );
}
