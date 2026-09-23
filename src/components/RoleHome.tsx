"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, defaultSettings } from "@/types/settings";
import { UserRole, ROLE_HOME, ROLE_LABELS } from "@/types/users";
import { fetchSession, logout } from "@/lib/session";
import Copyright from "@/components/Copyright";
import AdSense from "@/components/AdSense";
import HomepageCornerWrench from "@/components/HomepageCornerWrench";

const accountModule = {
  icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  label: "帳號與安全管理",
};

export default function RoleHome({ role }: { role: Exclude<UserRole, "admin"> }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSession(true).then((session) => {
      if (cancelled) return;
      if (!session || session.role !== role) {
        router.push("/");
        return;
      }
      setDisplayName(session.displayName);
    });
    return () => {
      cancelled = true;
    };
  }, [router, role]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (data?.success && data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      } catch (error) {
        console.error("載入設定失敗:", error);
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    void logout();
    router.push("/");
  }

  const roleLabel = ROLE_LABELS[role];
  const accountHref = `${ROLE_HOME[role]}/account`;

  return (
    <div className="min-h-screen flex flex-col items-center bg-page px-4 pt-[20px]">
      <HomepageCornerWrench />
      <div className="text-center mb-2">
        <h1 className="text-4xl font-bold mb-2">{settings.systemName || "數位校園工具箱"}</h1>
        <p className="text-xl text-t2">{settings.schoolFullName || "學校名稱"}</p>
        <p className="text-lg text-t3">{settings.academicYear} 學年度</p>
      </div>

      <div className="w-full max-w-2xl mt-4 mb-2 text-center">
        <h2 className="text-2xl font-bold text-t1">{roleLabel}功能首頁</h2>
        {displayName && <p className="text-t2 mt-1">{displayName}，您好</p>}
      </div>

      <div className="w-full max-w-2xl flex justify-end mb-4">
        <button onClick={handleLogout} className="btn-theme rounded-lg px-4 py-2 text-sm cursor-pointer">
          登出
        </button>
      </div>

      <hr className="w-full max-w-2xl border-themed mb-4" />

      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => router.push(accountHref)}
          className="flex items-center gap-3 border border-themed rounded-lg p-4 bg-hover transition-colors cursor-pointer text-left"
        >
          <span className="text-t3">{accountModule.icon}</span>
          <span className="font-medium text-t2">{accountModule.label}</span>
        </button>
      </div>

      <hr className="w-full max-w-2xl border-themed mb-4" />

      <div className="w-full max-w-2xl mb-8">
        <button onClick={handleLogout} className="btn-theme rounded-lg px-4 py-2 text-sm cursor-pointer">
          登出
        </button>
      </div>

      {settings.sponsorAdEnabled && (
        <div className="w-full max-w-2xl">
          <AdSense />
        </div>
      )}

      <div className="w-full max-w-2xl mt-auto">
        <Copyright mode={settings.copyrightNotice ? "啟用" : "關閉"} />
      </div>
    </div>
  );
}
