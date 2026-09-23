"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Settings, defaultSettings } from "@/types/settings";
import { UserRole, ROLE_LABELS, ROLE_SPECIFIC_FIELDS } from "@/types/users";
import { fetchSession, logout } from "@/lib/session";
import Copyright from "@/components/Copyright";

export default function AccountSecurityPage({ role }: { role: Exclude<UserRole, "admin"> }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [account, setAccount] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleFields, setRoleFields] = useState<Record<string, string>>({});
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSession(true).then((session) => {
      if (cancelled) return;
      if (!session || session.role !== role) {
        router.push("/");
        return;
      }
      setAccount(session.account);
      setEmail(session.email);
      setName(session.displayName);
      void loadProfile();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadProfile() {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success && data.profile) {
        if (data.profile.name) setName(data.profile.name);
        setRoleFields(data.profile.fields || {});
      }
    } catch (error) {
      console.error("載入用戶資料失敗:", error);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "請填寫所有密碼欄位" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "新密碼至少 8 碼" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "兩次輸入的新密碼不一致" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, oldPassword, newPassword, role }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: data.message || "密碼已更新" });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.message || "更新失敗" });
      }
    } catch {
      setMessage({ type: "error", text: "系統錯誤，請稍後再試" });
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    void logout();
    router.push("/");
  }

  const roleLabel = ROLE_LABELS[role];
  const backHref = `/${role}`;

  return (
    <div className="min-h-screen flex flex-col items-center bg-page px-4 pt-[20px]">
      <div className="text-center mb-2">
        <h1 className="text-4xl font-bold mb-2">{settings.systemName || "數位校園工具箱"}</h1>
        <p className="text-xl text-t2">{settings.schoolFullName || "學校名稱"}</p>
        <p className="text-lg text-t3">{settings.academicYear} 學年度</p>
      </div>

      <div className="w-full max-w-2xl mt-4 mb-2 text-center">
        <h2 className="text-2xl font-bold text-t1">帳號與安全管理</h2>
        <p className="text-t3 text-sm mt-1">{roleLabel}</p>
      </div>

      <div className="w-full max-w-2xl flex justify-between mb-4">
        <button onClick={() => router.push(backHref)} className="btn-theme rounded-lg px-4 py-2 text-sm cursor-pointer">
          返回首頁
        </button>
        <button onClick={handleLogout} className="btn-theme rounded-lg px-4 py-2 text-sm cursor-pointer">
          登出
        </button>
      </div>

      <hr className="w-full max-w-2xl border-themed mb-4" />

      {/* 基本資料 */}
      <div className="w-full max-w-2xl border border-themed rounded-lg p-6 mb-4">
        <h3 className="font-bold text-t1 mb-4">基本資料</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-t3">姓名：</span>
            <span className="text-t1">{name || "—"}</span>
          </div>
          <div>
            <span className="text-t3">電子郵件地址：</span>
            <span className="text-t1">{email || "—"}</span>
          </div>
          <div>
            <span className="text-t3">帳號：</span>
            <span className="text-t1">{account || "—"}</span>
          </div>
          {ROLE_SPECIFIC_FIELDS[role].map((f) => (
            <div key={f.key}>
              <span className="text-t3">{f.label}：</span>
              <span className="text-t1">{roleFields[f.key] || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 變更密碼 */}
      <form onSubmit={handleChangePassword} className="w-full max-w-2xl border border-themed rounded-lg p-6 mb-4">
        <h3 className="font-bold text-t1 mb-4">變更密碼</h3>

        {message && (
          <p className={`text-sm mb-3 ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
            {message.text}
          </p>
        )}

        <label className="block text-sm text-t2 mb-1">目前密碼</label>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="w-full input-theme rounded px-4 py-2 mb-3"
          autoComplete="current-password"
        />

        <label className="block text-sm text-t2 mb-1">新密碼（至少 8 碼）</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full input-theme rounded px-4 py-2 mb-3"
          autoComplete="new-password"
        />

        <label className="block text-sm text-t2 mb-1">確認新密碼</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full input-theme rounded px-4 py-2 mb-4"
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary rounded py-2 font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "更新中..." : "更新密碼"}
        </button>
      </form>

      <div className="w-full max-w-2xl mt-auto">
        <Copyright mode={settings.copyrightNotice ? "啟用" : "關閉"} />
      </div>
    </div>
  );
}
