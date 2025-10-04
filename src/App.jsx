// src/App.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
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
import BasicsUnifiedPage from "./pages/BasicsUnifiedPage.jsx"; // ✅ 통합 기초관리 페이지
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
// ✅ 서버 동기화 유틸
import {
  initUserState,
  queueSavePartial,
  subscribeUserState,
} from "./lib/remoteSync.js";

/* ===========================
   승인지연 안내
   =========================== */
function ApprovalGate({ email, onRefresh, onLogout }) {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm text-center">
        <h2 className="text-xl font-bold mb-2">승인 대기</h2>
        <p className="text-sm text-gray-600">
          <b>{email}</b> 계정은 아직 관리자의 승인이 필요합니다.
          <br />
          승인 후 이용하실 수 있어요.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={onRefresh} className="px-4 py-2 rounded-xl border hover:bg-gray-50">새로고침</button>
          <button onClick={onLogout} className="px-4 py-2 rounded-xl bg-gray-900 text-white">로그아웃</button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   상단바
   =========================== */
function Topbar({ sessionEmail, approved, onSignOut }) {
  if (!sessionEmail) return null;
  return (
    <div className="col-span-2 flex items-center justify-between px-4 py-2 border-b bg-white/70 backdrop-blur-sm">
      <div className="text-sm text-gray-600">
        로그인: <span className="font-medium">{sessionEmail}</span>
        {approved ? (
          <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700">승인됨</span>
        ) : (
          <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">승인대기</span>
        )}
      </div>
      <button
        className="px-3 py-1 rounded-lg border hover:bg-gray-50"
        onClick={onSignOut}
      >
        로그아웃
      </button>
    </div>
  );
}

/* ===========================
   로그인/회원가입/찾기 패널
   =========================== */
function AuthPanel() {
  // 모드: signin | signup | find_id | reset_pw
  const [mode, setMode] = useState("signin");

  // 공통
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 로그인(아이디 전용)
  const [usernameLogin, setUsernameLogin] = useState(
    localStorage.getItem("res_last_username") || ""
  );
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(true);
  useEffect(() => {
    if (remember) localStorage.setItem("res_last_username", usernameLogin);
    else localStorage.removeItem("res_last_username");
  }, [usernameLogin, remember]);

  // 회원가입
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  // 아이디/비밀번호 찾기
  const [findEmail, setFindEmail] = useState("");
  const [resetId, setResetId] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  // 포커스 복원용
  const firstInputRef = useRef(null);
  useEffect(() => {
    setMsg("");
    const t = setTimeout(() => firstInputRef.current?.focus?.(), 0);
    return () => clearTimeout(t);
  }, [mode]);

  // --- RPC 도우미 ---
  const findEmailByUsername = async (uname) => {
    try {
      const { data, error } = await supabase.rpc("get_email_by_username", {
        p_username: uname.trim(),
      });
      if (error) throw error;
      return data || "";
    } catch {
      return "";
    }
  };

  // --- 액션들 ---
  const doSignIn = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    const uname = usernameLogin.trim();
    if (!uname || !pw.trim()) return setMsg("아이디와 비밀번호를 입력하세요.");
    if (uname.includes("@")) return setMsg("이메일이 아닌 '아이디'를 입력하세요.");

    setBusy(true);
    try {
      const emailToUse = await findEmailByUsername(uname);
      if (!emailToUse) throw new Error("해당 아이디로 가입된 사용자가 없습니다.");
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: pw,
      });
      if (error) throw error;
    } catch (e2) {
      setMsg(e2.message || "로그인 실패");
    } finally {
      setBusy(false);
    }
  };

  const doSignUp = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!username.trim()) return setMsg("아이디를 입력하세요.");
    if (!email.trim()) return setMsg("이메일을 입력하세요.");
    if (!pw1.trim() || !pw2.trim()) return setMsg("비밀번호를 입력하세요.");
    if (pw1 !== pw2) return setMsg("비밀번호가 서로 다릅니다.");

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw1.trim(),
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        await supabase
          .from("profiles")
          .update({ username: username.trim(), email: email.trim() })
          .eq("id", uid);
      }
      setMsg("회원가입 요청이 접수되었습니다. 관리자 승인 후 로그인 가능합니다.");
      setMode("signin");
    } catch (e2) {
      setMsg(e2.message || "회원가입 실패");
    } finally {
      setBusy(false);
    }
  };

  const doFindId = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!findEmail.trim()) return setMsg("가입한 이메일을 입력하세요.");
    try {
      const { data, error } = await supabase.rpc("get_username_by_email", {
        p_email: findEmail.trim(),
      });
      if (error) throw error;
      if (!data) setMsg("해당 이메일로 가입된 아이디가 없습니다.");
      else setMsg(`아이디: ${data}`);
    } catch {
      setMsg("아이디 찾기 기능이 준비되지 않았습니다. (관리자: RPC 생성 필요)");
    }
  };

  const doResetPw = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!resetId.trim() || !resetEmail.trim()) {
      return setMsg("아이디와 이메일을 입력하세요.");
    }
    try {
      const { data } = await supabase.rpc("get_email_by_username", {
        p_username: resetId.trim(),
      });
      if (!data || data !== resetEmail.trim()) {
        return setMsg("아이디/이메일이 일치하지 않습니다.");
      }
      const { error } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim(),
        { redirectTo: window.location.origin + "/" }
      );
      if (error) throw error;
      setMsg("재설정 링크를 이메일로 보냈습니다. 메일함을 확인하세요.");
    } catch {
      setMsg("비밀번호 찾기 기능이 준비되지 않았습니다. (관리자: RPC 생성 필요)");
    }
  };

  // --- 카드 래퍼(고정) ---
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 to-white">
      <div className="w-full max-w-md rounded-3xl border bg-white/80 backdrop-blur shadow-lg p-8">
        <div className="text-center mb-2">
          <div className="text-3xl font-extrabold">
            <span className="bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-transparent">
              리셀러
            </span>
          </div>
        </div>
        <div className="text-center -mt-1 mb-6">
          <div className="text-3xl font-extrabold">
            <span className="bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-transparent">
              재고관리 프로그램
            </span>
          </div>
        </div>

        {/* 로그인 (항상 DOM에 존재, hidden 토글) */}
        <form hidden={mode !== "signin"} className="space-y-3" onSubmit={doSignIn}>
          <input
            ref={firstInputRef}
            className="w-full border rounded-xl px-3 py-3"
            placeholder="아이디"
            autoComplete="username"
            value={usernameLogin}
            onChange={(e) => setUsernameLogin(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="비밀번호"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <div className="flex items-center justify-between text-sm text-gray-600">
            <label className="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              로그인 정보 저장
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMode("find_id")} className="hover:underline">아이디 찾기</button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => setMode("reset_pw")} className="hover:underline">비밀번호 찾기</button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-2xl text-white font-semibold transition ${busy ? "bg-gray-400" : "bg-indigo-600 hover:-translate-y-0.5 hover:bg-indigo-700"}`}
          >
            로그인 →
          </button>
          {msg && <div className="text-center text-rose-600 text-sm">{msg}</div>}
          <div className="text-center text-sm text-gray-600">
            계정이 없으신가요?{" "}
            <button type="button" className="text-indigo-600 font-medium hover:underline" onClick={() => setMode("signup")}>
              회원가입
            </button>
          </div>
        </form>

        {/* 회원가입 */}
        <form hidden={mode !== "signup"} className="space-y-3" onSubmit={doSignUp}>
          <input
            ref={firstInputRef}
            className="w-full border rounded-xl px-3 py-3"
            placeholder="아이디"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="email"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="이메일"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="비밀번호"
            autoComplete="new-password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
          />
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="비밀번호 확인"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-2xl text-white font-semibold transition ${busy ? "bg-gray-400" : "bg-emerald-600 hover:-translate-y-0.5 hover:bg-emerald-700"}`}
          >
            회원가입 요청
          </button>
          {msg && <div className="text-center text-rose-600 text-sm">{msg}</div>}
          <div className="text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{" "}
            <button type="button" className="text-indigo-600 font-medium hover:underline" onClick={() => setMode("signin")}>
              로그인
            </button>
          </div>
        </form>

        {/* 아이디 찾기 */}
        <form hidden={mode !== "find_id"} className="space-y-3" onSubmit={doFindId}>
          <input
            ref={firstInputRef}
            type="email"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="가입한 이메일"
            autoComplete="email"
            value={findEmail}
            onChange={(e) => setFindEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-2xl text-white font-semibold transition ${busy ? "bg-gray-400" : "bg-indigo-600 hover:-translate-y-0.5 hover:bg-indigo-700"}`}
          >
            아이디 찾기
          </button>
          {msg && <div className="text-center text-rose-600 text-sm">{msg}</div>}
          <div className="text-center text-sm text-gray-600">
            <button type="button" className="text-indigo-600 font-medium hover:underline" onClick={() => setMode("signin")}>
              로그인으로
            </button>
          </div>
        </form>

        {/* 비밀번호 찾기 */}
        <form hidden={mode !== "reset_pw"} className="space-y-3" onSubmit={doResetPw}>
          <input
            ref={firstInputRef}
            className="w-full border rounded-xl px-3 py-3"
            placeholder="아이디"
            autoComplete="username"
            value={resetId}
            onChange={(e) => setResetId(e.target.value)}
          />
          <input
            type="email"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="이메일"
            autoComplete="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className={`w-full py-3 rounded-2xl text-white font-semibold transition ${busy ? "bg-gray-400" : "bg-indigo-600 hover:-translate-y-0.5 hover:bg-indigo-700"}`}
          >
            비밀번호 재설정 링크 보내기
          </button>
          {msg && <div className="text-center text-rose-600 text-sm">{msg}</div>}
          <div className="text-center text-sm text-gray-600">
            <button type="button" className="text-indigo-600 font-medium hover:underline" onClick={() => setMode("signin")}>
              로그인으로
            </button>
          </div>
        </form>

        <div className="text-xs text-gray-500 mt-6 leading-relaxed">
          * 관리자 승인(approved=true) 후에만 본 서비스를 사용할 수 있습니다.
        </div>
      </div>
    </div>
  );
}

/* ===========================
   메인 앱
   =========================== */
export default function App() {
  // Auth 세션
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

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

  // 관리자 승인 체크: 프로필
  const [profile, setProfile] = useState(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setProfileReady(false);
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
      if (error) setProfile(null);
      else setProfile(data || null);
      setProfileReady(true);
    })();
    return () => { ignore = true; };
  }, [session?.user?.id]);

  // 네임스페이스 적용 & 게스트 데이터 마이그레이션
  useEffect(() => {
    if (!session?.user) {
      setStorageNamespace("");
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
    reloadAllStates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // 전역 상태들
  const [products, setProducts] = useState(load(LS.PRODUCTS, []));
  const [lots, setLots] = useState(load(LS.LOTS, []));
  const [sales, setSales] = useState(load(LS.SALES, []));
  const [ioRec, setIoRec] = useState(load(LS.IOREC, []));
  const [partners, setPartners] = useState(load(LS.PARTNERS, []));
  const [payments, setPayments] = useState(load(LS.PAYMENTS, []));
  const [categoriesState, setCategoriesState] = useState(load(LS.CATEGORIES, []));
  const [brands, setBrands] = useState(load(LS.BRANDS, []));
  const [couriers, setCouriers] = useState(load(LS.COURIERS, []));

  useEffect(() => save(LS.PRODUCTS, products), [products]);
  useEffect(() => save(LS.LOTS, lots), [lots]);
  useEffect(() => save(LS.SALES, sales), [sales]);
  useEffect(() => save(LS.IOREC, ioRec), [ioRec]);
  useEffect(() => save(LS.PARTNERS, partners), [partners]);
  useEffect(() => save(LS.PAYMENTS, payments), [payments]);
  useEffect(() => save(LS.CATEGORIES, categoriesState), [categoriesState]);
  useEffect(() => save(LS.BRANDS, brands), [brands]);
  useEffect(() => save(LS.COURIERS, couriers), [couriers]);

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

  // 초기 탭/재고 패널
  const [current, setCurrent] = useState("ledger");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ✅ 하이드레이션 완료 플래그 (서버 스냅샷 로드 완료 시 true)
  const [hydrated, setHydrated] = useState(false);

  // 품목 추가
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
        const seqKey = "res_lot_seq_v1";
        const nextSeq = (Number(localStorage.getItem(seqKey)) || 0) + 1;
        localStorage.setItem(seqKey, String(nextSeq));
        // ✅ lot_seq도 서버에 반영 (하이드레이션 이후에만)
        if (session?.user?.id && hydrated) {
          queueSavePartial(session.user.id, { lot_seq: nextSeq });
        }
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

  const aggregated = useMemo(
    () => computeAggregated(products, lots),
    [products, lots]
  );

  /* ========= ✅ 서버 동기화: 초기 로드 ========= */
  useEffect(() => {
    (async () => {
      if (!session?.user || !profileReady) return;
      if (!profile?.approved && !profile?.is_admin) return;
      setHydrated(false); // 새 사용자/프로필 기준으로 다시 하이드레이트

      try {
        const localSnapshot = {
          products,
          lots,
          sales,
          iorec: ioRec,
          partners,
          payments,
          categories: categoriesState,
          brands,
          couriers,
          lot_seq: Number(localStorage.getItem("res_lot_seq_v1") || 0),
        };

        const server = await initUserState(session.user.id, localSnapshot);

        // 서버 상태를 기준으로 로컬 상태 덮어쓰기
        setProducts(server.products || []);
        setLots(server.lots || []);
        setSales(server.sales || []);
        setIoRec(server.iorec || []);
        setPartners(server.partners || []);
        setPayments(server.payments || []);
        setCategoriesState(server.categories || []);
        setBrands(server.brands || []);
        setCouriers(server.couriers || []);
        if (typeof server.lot_seq === "number") {
          localStorage.setItem("res_lot_seq_v1", String(server.lot_seq));
        }
      } catch (e) {
        console.error("initUserState failed:", e);
        // 실패해도 앱은 사용 가능해야 함
      } finally {
        // ✅ 서버 스냅샷으로 초기 하이드레이션 끝!
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, profileReady, profile?.approved, profile?.is_admin]);

  /* ========= ✅ 서버 동기화: 실시간 구독 (하이드레이션 이후) ========= */
  useEffect(() => {
    if (!session?.user || (!profile?.approved && !profile?.is_admin) || !hydrated) return;
    const off = subscribeUserState(session.user.id, (server) => {
      setProducts(server.products || []);
      setLots(server.lots || []);
      setSales(server.sales || []);
      setIoRec(server.iorec || []);
      setPartners(server.partners || []);
      setPayments(server.payments || []);
      setCategoriesState(server.categories || []);
      setBrands(server.brands || []);
      setCouriers(server.couriers || []);
      if (typeof server.lot_seq === "number") {
        localStorage.setItem("res_lot_seq_v1", String(server.lot_seq));
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, profile?.approved, profile?.is_admin, hydrated]);

  /* ========= ✅ 서버 동기화: 상태 변경 시 저장(디바운스) — 하이드레이션 이후에만 ========= */
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { partners }); }, [session?.user?.id, hydrated, partners]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { payments }); }, [session?.user?.id, hydrated, payments]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { categories: categoriesState }); }, [session?.user?.id, hydrated, categoriesState]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { brands }); }, [session?.user?.id, hydrated, brands]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { couriers }); }, [session?.user?.id, hydrated, couriers]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { products }); }, [session?.user?.id, hydrated, products]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { lots }); }, [session?.user?.id, hydrated, lots]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { iorec: ioRec }); }, [session?.user?.id, hydrated, ioRec]);
  useEffect(() => { if (session?.user?.id && hydrated) queueSavePartial(session.user.id, { sales }); }, [session?.user?.id, hydrated, sales]);

  /* ---------- 렌더 ---------- */
  if (!authReady)
    return <div className="min-h-screen grid place-items-center text-gray-500">초기화 중...</div>;

  if (!session) return <AuthPanel />;

  if (!profileReady)
    return <div className="min-h-screen grid place-items-center text-gray-500">프로필 확인 중...</div>;

  if (!profile?.approved && !profile?.is_admin) {
    return (
      <ApprovalGate
        email={session.user.email}
        onRefresh={async () => {
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

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr]">
      <Topbar
        sessionEmail={session.user.email}
        approved={!!profile?.approved}
        onSignOut={async () => {
          await supabase.auth.signOut();
          setStorageNamespace("");
          reloadAllStates();
        }}
      />
      <div className="grid grid-cols-[260px_1fr]">
        <Sidebar current={current} setCurrent={setCurrent} />

        <main className="p-6">
          {/* ✅ 통합 기초 관리 */}
          {current === "basics" && (
            <BasicsUnifiedPage
              partners={partners}
              setPartners={setPartners}
              payments={payments}
              setPayments={setPayments}
              categories={categoriesState}
              setCategories={setCategoriesState}
              brands={brands}
              setBrands={setBrands}
              couriers={couriers}
              setCouriers={setCouriers}
            />
          )}

          {/* 기존 개별 페이지 */}
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

          {/* 상품/입출고/반품/내역 */}
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

          {/* 장부/통계 */}
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

        {/* 재고 서랍 */}
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
