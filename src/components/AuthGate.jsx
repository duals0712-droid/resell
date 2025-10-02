import React from "react";
import { supabase } from "../lib/supabase";
import { setStorageUser } from "../lib/storage";

// 로컬 저장 키
const LS_REMEMBER = "res_remember_id_v1";
const LS_SAVED_ID = "res_saved_login_id_v1";

/** 아이콘들 재사용(매 렌더마다 새 노드 만들지 않도록) */
const Iuser = <span aria-hidden>👤</span>;
const Ilock = <span aria-hidden>🔒</span>;
const Imail = <span aria-hidden>✉️</span>;
const Ichk  = <span aria-hidden>✅</span>;

/** 공용 인풋: memo + forwardRef 로 포커스 안정화 */
const Input = React.memo(
  React.forwardRef(function InputBase({ icon, className = "", ...props }, ref) {
    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
          {icon}
        </div>
        <input
          ref={ref}
          {...props}
          className={[
            "w-full rounded-2xl border px-11 py-3",
            "focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400",
            "transition-all duration-300",
            className,
          ].join(" ")}
        />
      </div>
    );
  })
);

const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={[
      "w-full rounded-2xl py-3 font-semibold",
      "bg-indigo-600 text-white hover:bg-indigo-700",
      "transition-all duration-300 shadow-sm hover:shadow-md active:scale-[.98]",
      props.disabled ? "opacity-60 cursor-not-allowed" : "",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const LinkBtn = ({ children, ...props }) => (
  <button {...props} className="text-indigo-600 hover:underline transition">
    {children}
  </button>
);

const Card = ({ children }) => (
  <div
    className={[
      "w-full max-w-md rounded-3xl border bg-white/90 backdrop-blur p-6 md:p-8",
      "shadow-[0_8px_30px_rgba(0,0,0,.06)]",
      "transition-all duration-300",
    ].join(" ")}
  >
    {children}
  </div>
);

const Header = React.memo(function Header() {
  return (
    <div className="text-center select-none">
      <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
        <span className="block">리셀러</span>
        <span className="bg-gradient-to-r from-indigo-500 via-sky-500 to-purple-500 bg-clip-text text-transparent">
          재고관리 프로그램
        </span>
      </h1>
    </div>
  );
});

export default function AuthGate({ children }) {
  const [user, setUser] = React.useState(null);
  const [view, setView] = React.useState("signin"); // 'signin' | 'signup' | 'findId' | 'findPw' | 'resetPw'
  const [msg, setMsg] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // ---- 공통 입력 상태 ----
  const [loginId, setLoginId] = React.useState("");
  const [loginPw, setLoginPw] = React.useState("");
  const [remember, setRemember] = React.useState(false);

  // 회원가입
  const [suId, setSuId] = React.useState("");
  const [suEmail, setSuEmail] = React.useState("");
  const [suPw, setSuPw] = React.useState("");
  const [suPw2, setSuPw2] = React.useState("");

  // 아이디 찾기
  const [findEmail, setFindEmail] = React.useState("");

  // 비번 찾기(요청)
  const [fpId, setFpId] = React.useState("");
  const [fpEmail, setFpEmail] = React.useState("");

  // 비번 재설정(이메일 링크 통해 들어온 뒤)
  const [npw1, setNpw1] = React.useState("");
  const [npw2, setNpw2] = React.useState("");

  // 현재 활성 인풋에 붙일 ref (포커스 유지/복원용)
  const activeInputRef = React.useRef(null);

  // 세션 구독 + 리커버리 링크 감지
  React.useEffect(() => {
    // 로컬 저장된 아이디
    const r = localStorage.getItem(LS_REMEMBER) === "1";
    setRemember(r);
    if (r) setLoginId(localStorage.getItem(LS_SAVED_ID) || "");

    // 현재 세션
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setStorageUser(u?.id ?? null);
    });

    // 비밀번호 재설정 링크로 진입하면 뷰 전환
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) setView("resetPw");

    const { data: sub } = supabase.auth.onAuthStateChange((evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setStorageUser(u?.id ?? null);
      if (evt === "PASSWORD_RECOVERY") setView("resetPw");
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // 뷰 바뀔 때 안내문 초기화 + 포커스 복원
  React.useEffect(() => {
    setMsg("");
    // 다음 틱에 포커스 (DOM 업데이트 이후)
    const t = setTimeout(() => {
      activeInputRef.current?.focus?.();
    }, 0);
    return () => clearTimeout(t);
  }, [view]);

  // ---------- 유틸 ----------
  const uiError = (e) =>
    setMsg(e?.message || e?.error_description || "오류가 발생했어요.");

  // username(아이디) -> email 변환 (익명 허용 RPC)
  const getEmailById = async (username) => {
    const { data, error } = await supabase.rpc("email_by_username", {
      p_username: username,
    });
    if (error) throw error;
    return data || null;
  };

  // email -> username 찾기 (익명 허용 RPC)
  const getUsernameByEmail = async (email) => {
    const { data, error } = await supabase.rpc("username_by_email", {
      p_email: email,
    });
    if (error) throw error;
    return data || null;
  };

  // username+email 매칭 확인(비번 찾기용)
  const checkUsernameEmail = async (username, email) => {
    const { data, error } = await supabase.rpc("check_username_email", {
      p_username: username,
      p_email: email,
    });
    if (error) throw error;
    return !!data;
  };

  // ---------- 로그인(ID+비번) ----------
  const onSignIn = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!loginId.trim() || !loginPw.trim()) {
      setMsg("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const email = await getEmailById(loginId.trim());
      if (!email) throw new Error("해당 아이디가 존재하지 않습니다.");
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPw,
      });
      if (error) throw error;

      // remember me
      if (remember) {
        localStorage.setItem(LS_REMEMBER, "1");
        localStorage.setItem(LS_SAVED_ID, loginId.trim());
      } else {
        localStorage.removeItem(LS_REMEMBER);
        localStorage.removeItem(LS_SAVED_ID);
      }
    } catch (e2) {
      uiError(e2);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- 회원가입(아이디/이메일/비번) ----------
  const onSignUp = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!suId.trim() || !suEmail.trim() || !suPw.trim() || !suPw2.trim()) {
      setMsg("모든 항목을 입력해주세요.");
      return;
    }
    if (suPw !== suPw2) {
      setMsg("비밀번호가 서로 다릅니다.");
      return;
    }
    setSubmitting(true);
    try {
      // 1) 가입(이메일+비번)
      const { data, error } = await supabase.auth.signUp({
        email: suEmail.trim(),
        password: suPw,
      });
      if (error) throw error;

      // 2) 프로필에 username 저장(가입 트리거가 profiles 한 줄 생성)
      const uid = data.user?.id;
      if (uid) {
        const { error: upErr } = await supabase
          .from("profiles")
          .update({ username: suId.trim() })
          .eq("id", uid);
        if (upErr) throw upErr;
      }

      setMsg("회원가입 요청 완료! 관리자가 승인하면 로그인할 수 있습니다.");
      setView("signin");
      setLoginId(suId);
    } catch (e2) {
      uiError(e2);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- 아이디 찾기(이메일로) ----------
  const onFindId = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!findEmail.trim()) {
      setMsg("가입했던 이메일을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const username = await getUsernameByEmail(findEmail.trim());
      if (!username) {
        setMsg("해당 이메일로 가입된 아이디가 없습니다.");
      } else {
        // 마스킹 표시
        const masked =
          username.length <= 2
            ? username[0] + "*"
            : username.slice(0, 2) +
              "*".repeat(Math.max(1, username.length - 2));
        setMsg(`아이디: ${masked}`);
      }
    } catch (e2) {
      uiError(e2);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- 비밀번호 찾기(아이디+이메일 확인 -> 이메일로 재설정 링크 발송) ----------
  const onFindPw = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!fpId.trim() || !fpEmail.trim()) {
      setMsg("아이디와 이메일을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const ok = await checkUsernameEmail(fpId.trim(), fpEmail.trim());
      if (!ok) throw new Error("아이디와 이메일이 일치하지 않습니다.");

      const { error } = await supabase.auth.resetPasswordForEmail(
        fpEmail.trim(),
        { redirectTo: window.location.origin }
      );
      if (error) throw error;

      setMsg("이메일로 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인해주세요.");
    } catch (e2) {
      uiError(e2);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- 새 비밀번호 설정(이메일 링크 통해 들어온 뒤) ----------
  const onResetPw = async (e) => {
    e?.preventDefault?.();
    setMsg("");
    if (!npw1.trim() || !npw2.trim()) {
      setMsg("새 비밀번호를 입력해주세요.");
      return;
    }
    if (npw1 !== npw2) {
      setMsg("새 비밀번호가 서로 다릅니다.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: npw1 });
      if (error) throw error;
      setMsg("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      await supabase.auth.signOut();
      setView("signin");
      setLoginPw("");
    } catch (e2) {
      uiError(e2);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- 게이트 ----------
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-white to-indigo-50 p-6">
        <Card>
          <Header />

          {/* 모든 화면을 '항상 마운트' 하고 hidden 으로만 전환 → 포커스 유지 */}
          {/* ---- 로그인 ---- */}
          <form
            hidden={view !== "signin"}
            className="mt-6 space-y-3"
            onSubmit={onSignIn}
          >
            <Input
              ref={activeInputRef}
              autoComplete="username"
              placeholder="아이디"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              icon={Iuser}
            />
            <Input
              autoComplete="current-password"
              placeholder="비밀번호"
              type="password"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              icon={Ilock}
            />

            <div className="flex items-center justify-between text-sm text-gray-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-indigo-600"
                />
                로그인 정보 저장
              </label>
              <div className="flex items-center gap-3">
                <LinkBtn onClick={() => setView("findId")}>아이디 찾기</LinkBtn>
                <span className="text-gray-300">|</span>
                <LinkBtn onClick={() => setView("findPw")}>비밀번호 찾기</LinkBtn>
              </div>
            </div>

            {msg && <div className="text-rose-600 text-sm">{msg}</div>}

            <PrimaryBtn type="submit" disabled={submitting}>
              로그인 →
            </PrimaryBtn>

            <div className="text-center text-sm text-gray-600">
              계정이 없으신가요?{" "}
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => setView("signup")}
              >
                회원가입
              </button>
            </div>
          </form>

          {/* ---- 회원가입 ---- */}
          <form
            hidden={view !== "signup"}
            className="mt-6 space-y-3"
            onSubmit={onSignUp}
          >
            <Input
              ref={activeInputRef}
              autoComplete="username"
              placeholder="아이디"
              value={suId}
              onChange={(e) => setSuId(e.target.value)}
              icon={Iuser}
            />
            <Input
              autoComplete="email"
              placeholder="이메일"
              type="email"
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              icon={Imail}
            />
            <Input
              autoComplete="new-password"
              placeholder="비밀번호"
              type="password"
              value={suPw}
              onChange={(e) => setSuPw(e.target.value)}
              icon={Ilock}
            />
            <Input
              autoComplete="new-password"
              placeholder="비밀번호 확인"
              type="password"
              value={suPw2}
              onChange={(e) => setSuPw2(e.target.value)}
              icon={Ichk}
            />

            {msg && <div className="text-rose-600 text-sm">{msg}</div>}

            <PrimaryBtn type="submit" disabled={submitting}>
              회원가입 요청
            </PrimaryBtn>

            <div className="text-center text-sm text-gray-600">
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => setView("signin")}
              >
                로그인
              </button>
            </div>
          </form>

          {/* ---- 아이디 찾기 ---- */}
          <form
            hidden={view !== "findId"}
            className="mt-6 space-y-3"
            onSubmit={onFindId}
          >
            <Input
              ref={activeInputRef}
              autoComplete="email"
              placeholder="가입한 이메일"
              type="email"
              value={findEmail}
              onChange={(e) => setFindEmail(e.target.value)}
              icon={Imail}
            />
            {msg && <div className="text-rose-600 text-sm">{msg}</div>}
            <PrimaryBtn type="submit" disabled={submitting}>
              아이디 찾기
            </PrimaryBtn>
            <div className="text-center text-sm text-gray-600">
              돌아가기 →{" "}
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => setView("signin")}
              >
                로그인
              </button>
            </div>
          </form>

          {/* ---- 비밀번호 찾기(메일 발송) ---- */}
          <form
            hidden={view !== "findPw"}
            className="mt-6 space-y-3"
            onSubmit={onFindPw}
          >
            <Input
              ref={activeInputRef}
              autoComplete="username"
              placeholder="아이디"
              value={fpId}
              onChange={(e) => setFpId(e.target.value)}
              icon={Iuser}
            />
            <Input
              autoComplete="email"
              placeholder="이메일"
              type="email"
              value={fpEmail}
              onChange={(e) => setFpEmail(e.target.value)}
              icon={Imail}
            />
            {msg && <div className="text-rose-600 text-sm">{msg}</div>}
            <PrimaryBtn type="submit" disabled={submitting}>
              비밀번호 재설정 메일 보내기
            </PrimaryBtn>
            <div className="text-center text-sm text-gray-600">
              돌아가기 →{" "}
              <button
                type="button"
                className="text-indigo-600 hover:underline"
                onClick={() => setView("signin")}
              >
                로그인
              </button>
            </div>
          </form>

          {/* ---- 비밀번호 재설정(링크 통해 진입) ---- */}
          <form
            hidden={view !== "resetPw"}
            className="mt-6 space-y-3"
            onSubmit={onResetPw}
          >
            <Input
              ref={activeInputRef}
              autoComplete="new-password"
              placeholder="새 비밀번호"
              type="password"
              value={npw1}
              onChange={(e) => setNpw1(e.target.value)}
              icon={Ilock}
            />
            <Input
              autoComplete="new-password"
              placeholder="새 비밀번호 확인"
              type="password"
              value={npw2}
              onChange={(e) => setNpw2(e.target.value)}
              icon={Ichk}
            />
            {msg && <div className="text-rose-600 text-sm">{msg}</div>}
            <PrimaryBtn type="submit" disabled={submitting}>
              변경
            </PrimaryBtn>
            <div className="text-center text-sm text-gray-600">
              변경 후 자동 로그아웃 되며, 다시 로그인 화면으로 이동합니다.
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // 로그인된 경우 → 상단 미니바 + children
  return (
    <div className="min-h-screen">
      <div className="p-2 text-right text-sm">
        <span className="mr-2 text-gray-600">{user.email}</span>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          className="px-3 py-1 rounded-lg border hover:bg-gray-50 transition"
        >
          로그아웃
        </button>
      </div>
      {children}
    </div>
  );
}
