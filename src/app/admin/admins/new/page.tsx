"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit() {
    setError("");
    setSuccess("");

    if (!email || !account || !password) {
      setError("請填寫完整資訊");
      return;
    }

    if (password !== confirmPassword) {
      setError("兩次密碼不一致");
      return;
    }

    if (password.length < 6) {
      setError("密碼至少 6 個字元");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, account, password, displayName }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message);
        setLoading(false);
        return;
      }

      setSuccess("管理員建立成功！");
      setTimeout(() => router.push("/admin"), 1500);
    } catch {
      setError("系統錯誤，請稍後再試");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">新增管理員</h2>

      <div className="bg-card rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-t2 mb-1">電子郵件 *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full input-theme rounded px-3 py-2"
            placeholder="admin@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-t2 mb-1">登入帳號 *</label>
          <input
            type="text"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full input-theme rounded px-3 py-2"
            placeholder="admin"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-t2 mb-1">顯示名稱</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full input-theme rounded px-3 py-2"
            placeholder="系統管理員"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-t2 mb-1">密碼 *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full input-theme rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-t2 mb-1">確認密碼 *</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full input-theme rounded px-3 py-2"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-500 text-sm">{success}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "建立中..." : "建立管理員"}
          </button>
          <button
            onClick={() => router.push("/admin")}
            className="flex-1 btn-theme py-2 rounded cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
