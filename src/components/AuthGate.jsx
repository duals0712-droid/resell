import React from 'react';
import { supabase } from '../lib/supabase';
import { setStorageUser } from '../lib/storage';

export default function AuthGate({ children }) {
  const [user, setUser] = React.useState(null);
  const [mode, setMode] = React.useState('signin'); // 'signin' | 'signup'
  const emailRef = React.useRef(null);
  const pwRef = React.useRef(null);
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    // 현재 세션 불러오기
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setStorageUser(u?.id ?? null);
    });
    // 세션 변경 구독
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setStorageUser(u?.id ?? null);
    });
    return () => sub.subscription?.unsubscribe();
  }, []);

  const onSignIn = async () => {
    setMsg('');
    const email = emailRef.current.value;
    const password = pwRef.current.value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
  };

  const onSignUp = async () => {
    setMsg('');
    const email = emailRef.current.value;
    const password = pwRef.current.value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else setMsg('가입 완료! 이메일 확인(필요시) 후 로그인하세요.');
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
          <h1 className="text-xl font-bold mb-4 text-center">로그인</h1>
          <div className="space-y-2">
            <input ref={emailRef} className="w-full border rounded-xl px-3 py-2" placeholder="이메일" />
            <input ref={pwRef} type="password" className="w-full border rounded-xl px-3 py-2" placeholder="비밀번호" />
            {msg && <div className="text-rose-600 text-sm">{msg}</div>}
            {mode === 'signin' ? (
              <>
                <button onClick={onSignIn} className="w-full rounded-xl bg-indigo-600 text-white py-2">로그인</button>
                <button onClick={() => setMode('signup')} className="w-full rounded-xl border py-2">회원가입</button>
              </>
            ) : (
              <>
                <button onClick={onSignUp} className="w-full rounded-xl bg-emerald-600 text-white py-2">회원가입</button>
                <button onClick={() => setMode('signin')} className="w-full rounded-xl border py-2">로그인으로</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 로그인된 경우
  return (
    <div>
      <div className="p-2 text-right text-sm">
        <span className="mr-2 text-gray-600">{user.email}</span>
        <button onClick={onSignOut} className="px-3 py-1 rounded-lg border">로그아웃</button>
      </div>
      {children}
    </div>
  );
}
