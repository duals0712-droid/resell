// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import {
  LS,
  load,
  save,
  setStorageNamespace,
  migrateLocalDataToNamespace,
} from "./lib/storage.js";
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
import { supabase } from "./lib/supabase.js";

/* ===========================
   로그인/회원가입 간단 패널
   =========================== */
function AuthPanel() {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const run = async () => {
    setMsg("");
    if (!email.trim() || !pw.trim()) {
      setMsg("이메일/비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pw.trim(),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pw.trim(),
        });
        if (error) throw error;
        setMsg("회원가입 완료! 이제 로그인 해주세요.");
        setMode("signin");
      }
    } catch (e) {
      setMsg(e.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold mb-3 text-center">Resell Manager</h1>
        <div className="flex gap-2 mb-3">
          <button
            className={`flex-1 px-3 py-2 rounded-xl border ${
              mode === "signin" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
            }`}
            onClick={() => setMode("signin")}
          >
            로그인
          </button>
          <button
            className={`flex-1 px-3 py-2 rounded-xl border ${
              mode === "signup" ? "bg-indigo-50 border-indigo-400" : "hover:bg-gray-50"
            }`}
            onClick={() => setMode("signup")}
          >
            회원가입
          </button>
        </div>

        <div className="space-y-2">
          <input
            type="email"
            className="w-full border rounded-xl px-3 py-2"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-2"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button
            onClick={run}
            disabled={loading}
            className={`w-full px-4 py-2 rounded-xl text-white ${
              loading ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {mode === "signin" ? "로그인" : "회원가입"}
          </button>
          {msg && <div className="text-sm text-center text-rose-600 mt-1">{msg}</div>}
        </div>

        <div className="text-xs text-gray-500 mt-4 leading-relaxed">
          * 관리자 승인(approved=true) 후에만 본 서비스를 사용할 수 있습니다.
        </div>
      </div>
    </div>
  );
}

/* ===========================
   승인 대기 게이트 화면
   =========================== */
function ApprovalGate({ email, onRefresh, onLogout }) {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm text-center">
        <h2 className="text-xl font-bold mb-2">승인 대기</h2>
        <p className="text-sm text-gray-600">
          <b>{email}</b> 계정은 아직 관리자의 승인이 필요합니다.
          <br />
          관리자에게 문의해 승인(approved)을 받으면 사용하실 수 있어요.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={onRefresh}
            className="px-4 py-2 rounded-xl border hover:bg-gray-50"
          >
            새로고침
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white"
          >
            로그아웃
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-3">
          (관리자: Supabase Table Editor → <b>profiles</b>에서 해당 사용자 <b>approved</b>를 true로 변경)
        </div>
      </div>
    </div>
  );
}

/* ===========================
   메인 앱
   =========================== */
export default function App() {
  /* ---------- Auth 세션 ---------- */
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // 세션 로드 + 구독
  useEffect(() => {
    let sub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setAuthReady(true);

      sub = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession ?? null);
      }).data.subscription;
    })();
    return () => sub && sub.unsubscribe();
  }, []);

  /* ---------- 관리자 승인 체크: 프로필 로딩 ---------- */
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setProfileReady(false);

      // 로그인 안됨 → 프로필 필요 없음
      if (!session?.user) {
        setProfile(null);
        setProfileReady(true);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("approved,is_admin,is_paid,username,full_name,avatar_url,email")
        .eq("id", session.user.id)
        .single();

      if (ignore) return;

      if (error) {
        console.error("load profile error:", error);
        setProfile(null);
      } else {
        setProfile(data || null);
      }
      setProfileReady(true);
    })();

    return () => { ignore = true; };
  }, [session?.user?.id]);

  // 세션 → 네임스페이스 적용 & 게스트 데이터 1회 마이그레이션
  useEffect(() => {
    if (!session?.user) {
      setStorageNamespace("");
      // 게스트 데이터 보여주도록 아래에서 상태 재로드
    } else {
      const ns = `user:${session.user.id}`;
      setStorageNamespace(ns);

      const flagKey = `res_migrated_${session.user.id}`;
      const already = localStorage.getItem(flagKey);
      if (!already) {
        migrateLocalDataToNamespace(ns, Object.values(LS), { overwrite: false });
        localStorage.setItem(flagKey, "1");
      }
    }
    // 네임스페이스 변경 시 현재 공간에서 상태 재로드
    reloadAllStates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  /* ---------- 전역 상태들 ---------- */
  const [products, setProducts] = useState(load(LS.PRODUCTS, []));
  const [lots, setLots] = useState(load(LS.LOTS, []));
  const [sales, setSales] = useState(load(LS.SALES, []));
  const [ioRec, setIoRec] = useState(load(LS.IOREC, []));
  const [partners, setPartners] = useState(load(LS.PARTNERS, []));
  const [payments, setPayments] = useState(load(LS.PAYMENTS, []));
  const [categoriesState, setCategoriesState] = useState(load(LS.CATEGORIES, []));
  const [brands, setBrands] = useState(load(LS.BRANDS, []));
  const [couriers, setCouriers] = useState(load(LS.COURIERS, []));

  // 저장 동기화
  useEffect(() => save(LS.PRODUCTS, products), [products]);
  useEffect(() => save(LS.LOTS, lots), [lots]);
  useEffect(() => save(LS.SALES, sales), [sales]);
  useEffect(() => save(LS.IOREC, ioRec), [ioRec]);
  useEffect(() => save(LS.PARTNERS, partners), [partners]);
  useEffect(() => save(LS.PAYMENTS, payments), [payments]);
  useEffect(() => save(LS.CATEGORIES, categoriesState), [categoriesState]);
  useEffect(() => save(LS.BRANDS, brands), [brands]);
  useEffect(() => save(LS.COURIERS, couriers), [couriers]);

  // 한 방에 현재 네임스페이스에서 로드
  const reloadAllStates = () => {
    setProducts(load(LS.PRODUCTS, []));
    setLots(load(LS.LOTS, []));
    setSales(load(LS.SALES, []));
    setIoRec(load(LS.IOREC, []));
    setPartners(load(LS.PARTNERS, []));
    setPayments(load(LS.PAYMENTS, []));
    setCategoriesState(load(LS.CATEGORIES, []));
    setBrands(load(LS.BRANDS, []));
    setCouriers(load(LS.COURIERS, []));
  };

  // 초기 탭은 ‘통합 장부’
  const [current, setCurrent] = useState("ledger");

  // 재고 패널: 기본 접힘(false)
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 품목 추가 + 초기 입고 기록 생성(선택)
  const addProduct = (
    code,
    name,
    sizesStr,
    memo,
    entries = [],
    image = "",
    brand = "",
    category = ""
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
        // lot seq
        const seqKey = "res_lot_seq_v1";
        const nextSeq = (Number(localStorage.getItem(seqKey)) || 0) + 1;
        localStorage.setItem(seqKey, String(nextSeq));

        const lot = {
          id: uid(),
          productId: product.id,
          size,
          qty,
          purchasePrice: price,
          receivedAt,
          createdAt: new Date().toISOString(),
          createdSeq: nextSeq,
        };
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
  const aggregated = useMemo(
    () => computeAggregated(products, lots),
    [products, lots]
  );

  // 상단 사용자/로그아웃 바
  const Topbar = () =>
    !session?.user ? null : (
      <div className="col-span-2 flex items-center justify-between px-4 py-2 border-b bg-white/70 backdrop-blur-sm">
        <div className="text-sm text-gray-600">
          로그인: <span className="font-medium">{session.user.email}</span>
          {profile?.approved ? (
            <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700">
              승인됨
            </span>
          ) : (
            <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
              승인대기
            </span>
          )}
        </div>
        <button
          className="px-3 py-1 rounded-lg border hover:bg-gray-50"
          onClick={async () => {
            await supabase.auth.signOut();
            setStorageNamespace("");
            reloadAllStates();
          }}
        >
          로그아웃
        </button>
      </div>
    );

  /* ---------- 렌더 ---------- */

  // 아직 세션 확인 전이면 잠깐 대기
  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-500">
        초기화 중...
      </div>
    );
  }

  // 세션 없으면 로그인/회원가입 패널
  if (!session) {
    return <AuthPanel />;
  }

  // 프로필 로딩 중이면 잠깐 대기
  if (!profileReady) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-500">
        프로필 확인 중...
      </div>
    );
  }

  // 승인되지 않았고, 관리자가 아니면 접근 차단 화면
  if (!profile?.approved && !profile?.is_admin) {
    return (
      <ApprovalGate
        email={session.user.email}
        onRefresh={async () => {
          // 다시 불러오기
          const { data, error } = await supabase
            .from("profiles")
            .select("approved,is_admin,is_paid,username,full_name,avatar_url,email")
            .eq("id", session.user.id)
            .single();
          if (!error) setProfile(data || null);
        }}
        onLogout={async () => {
          await supabase.auth.signOut();
          setStorageNamespace("");
          reloadAllStates();
        }}
      />
    );
  }

  // 로그인 + 승인 완료 → 본앱
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr]">
      <Topbar />
      <div className="grid grid-cols-[260px_1fr]">
        <Sidebar current={current} setCurrent={setCurrent} />

        <main className="p-6">
          {current === "partners" && (
            <div className="p-6 rounded-2xl bg-white/0">
              <PartnersPage partners={partners} setPartners={setPartners} />
            </div>
          )}

          {current === "payments" && (
            <div className="p-6 rounded-2xl bg-white/0">
              <PaymentsPage payments={payments} setPayments={setPayments} />
            </div>
          )}

          {current === "categories" && (
            <div className="p-6 rounded-2xl bg-white/0">
              <CategoriesPage
                categories={categoriesState}
                setCategories={setCategoriesState}
                brands={brands}
                setBrands={setBrands}
              />
            </div>
          )}

          {current === "courier" && (
            <div className="p-6 rounded-2xl bg-white/0">
              <CouriersPage couriers={couriers} setCouriers={setCouriers} />
            </div>
          )}

          {current === "products" && (
            <ProductsPage
              products={products}
              setProducts={setProducts}
              lots={lots}
              setLots={setLots}
              addProduct={addProduct}
              brands={brands}
              categories={categoriesState}
            />
          )}

          {current === "io-register" && (
            <InOutRegister
              products={products}
              lots={lots}
              setLots={setLots}
              sales={sales}
              setSales={setSales}
              ioRec={ioRec}
              setIoRec={setIoRec}
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
            <OutLaterListPage
              partners={partners}
              sales={sales}
              setSales={setSales}
            />
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
    </div>
  );
}
