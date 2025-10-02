// src/pages/WaitingApproval.jsx
import React from "react";
import { supabase } from "../lib/supabase";

export default function WaitingApproval({ email }) {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 text-center space-y-4">
        <div className="text-2xl font-bold">승인 대기 중</div>
        <p className="text-gray-600">
          {email ? <b>{email}</b> : "가입하신 계정"} 은(는) 아직
          <br /> 관리자 승인 전입니다.
        </p>
        <p className="text-sm text-gray-500">
          승인이 완료되면 다시 로그인하여 이용할 수 있어요.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="px-4 py-2 rounded-xl bg-gray-900 text-white"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
