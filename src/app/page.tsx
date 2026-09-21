"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings, defaultSettings } from "@/types/settings";
import Copyright from "@/components/Copyright";
import AdSense from "@/components/AdSense";

export default function Home() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [role, setRole] = useState<"student" | "staff" | "admin">("student");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("user_session");
    if (session) {
      try {
        const user = JSON.parse(session);
        if (user.role === "admin") {
          router.push("/admin");
          return;
        }
      } catch {}
    }
    setCheckingSession(false);
  }, [router]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const docRef = doc(db, "settings", "system");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as Settings);
        }
      } catch (error) {
        console.error("載入設定失敗:", error);
      }
    }
    loadSettings();
  }, []);

  async function handleLogin() {
    if (!account || !password) {
      setError("請輸入帳號與密碼");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message);
        setLoading(false);
        return;
      }

      localStorage.setItem(
        "user_session",
        JSON.stringify({
          ...data.user,
          role: "admin",
          loginTime: Date.now(),
        })
      );

      router.push("/admin");
    } catch {
      setError("系統錯誤，請稍後再試");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleLogin();
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">載入中...</p>
      </div>
    );
  }

  if (!settings.systemEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">系統目前暫停服務</h1>
          <p className="text-gray-500">請稍後再試</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4 pt-[20px]">
      {/* 標題區域 */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">數位校園工具箱</h1>
        <p className="text-xl text-gray-700">{settings.schoolFullName || "學校名稱"}</p>
        <p className="text-lg text-gray-500">{settings.academicYear} 學年度</p>
      </div>

      <hr className="w-full max-w-md border-gray-300 mb-6" />

      {/* 登入表單 */}
      <div className="w-full max-w-md border border-gray-200 rounded-lg p-8">
        <p className="text-center text-gray-700 mb-4">
          歡迎使用，請先選擇身分後登入
        </p>

        {/* 身分選擇 */}
        <div className="flex justify-center gap-6 mb-6">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="student"
              checked={role === "student"}
              onChange={() => setRole("student")}
              className="accent-black"
            />
            <span>學生</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="staff"
              checked={role === "staff"}
              onChange={() => setRole("staff")}
              className="accent-black"
            />
            <span>教職員</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
              className="accent-black"
            />
            <span>管理員</span>
          </label>
        </div>

        <hr className="border-gray-200 mb-6" />

        {/* 帳號密碼 */}
        <input
          type="text"
          placeholder="帳號 / 電子郵件"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border border-gray-300 rounded px-4 py-3 mb-4 text-gray-700 placeholder-gray-400"
        />
        <div className="relative mb-4">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full border border-gray-300 rounded px-4 py-3 pr-12 text-gray-700 placeholder-gray-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-black text-white rounded py-3 font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? "登入中..." : "登入"}
        </button>

        <p className="text-center text-sm text-gray-500 mt-3 cursor-pointer hover:underline">
          忘記密碼（同時重設驗證碼）
        </p>

        {/* 分隔線 */}
        <div className="flex items-center gap-3 my-6">
          <hr className="flex-1 border-gray-300" />
          <span className="text-gray-400 text-sm">或</span>
          <hr className="flex-1 border-gray-300" />
        </div>

        {/* Google 登入 */}
        <button className="w-full border border-gray-300 rounded py-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.33-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          以 Google 帳號登入
        </button>

        {/* 分隔線 */}
        <div className="flex items-center gap-3 my-6">
          <hr className="flex-1 border-gray-300" />
          <span className="text-gray-400 text-sm">或</span>
          <hr className="flex-1 border-gray-300" />
        </div>

        {/* Workspace 登入 */}
        <p className="text-center text-sm text-gray-500 mb-2">以Workspace帳號登入</p>
        <button className="w-full border border-gray-300 rounded py-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          登入
        </button>
      </div>

      {/* 廣告區域 */}
      {settings.sponsorAdEnabled && (
        <div className="w-full max-w-md mt-8">
          <AdSense />
        </div>
      )}

      {/* 版權宣告 */}
      <div className="w-full max-w-md mt-8">
        <Copyright mode={settings.copyrightNotice ? "啟用" : "關閉"} />
      </div>

      {/* 登入Loading遮罩 */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}>
          <div className="bg-white rounded-2xl p-8 text-center space-y-4 shadow-lg">
            <div className="flex justify-center">
              <svg className="animate-spin" viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#333" strokeWidth={2} strokeLinecap="round">
                <circle cx={12} cy={12} r={10} stroke="#e5e7eb" strokeWidth={2} fill="none" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth={2} />
              </svg>
            </div>
            <p className="text-base font-semibold text-gray-800">登入中，請稍候…</p>
            <p className="text-xs text-gray-400">正在驗證身分</p>
          </div>
        </div>
      )}
    </div>
  );
}
