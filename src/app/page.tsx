"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Settings, defaultSettings } from "@/types/settings";

export default function Home() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [role, setRole] = useState<"student" | "staff" | "admin">("student");

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      {/* 標題區域 */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">數位校園工作箱</h1>
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
          className="w-full border border-gray-300 rounded px-4 py-3 mb-4 text-gray-700 placeholder-gray-400"
        />
        <input
          type="password"
          placeholder="密碼"
          className="w-full border border-gray-300 rounded px-4 py-3 mb-4 text-gray-700 placeholder-gray-400"
        />

        <button className="w-full bg-black text-white rounded py-3 font-medium hover:bg-gray-800 transition-colors">
          登入
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
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
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

      {/* 頁尾廣告區域 */}
      <div className="w-full max-w-md mt-8 text-center">
        <p className="text-sm text-gray-400">&gt;&gt;以下廣告由Google AdSense推播&lt;&lt;</p>
        {/* 廣告版位 */}
      </div>
    </div>
  );
}
