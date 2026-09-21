"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserSession {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  role: string;
}

interface AdminUser {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  twoFactorMethod: string;
  lastLogin: number;
  loginCount: number;
  createdAt: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("user_session");
    if (!session) {
      router.push("/");
      return;
    }

    try {
      const parsed = JSON.parse(session) as UserSession;
      if (parsed.role !== "admin") {
        router.push("/");
        return;
      }
      setUser(parsed);
      loadAdmins();
    } catch {
      router.push("/");
    }
  }, [router]);

  async function loadAdmins() {
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      if (data.success) {
        setAdmins(data.admins);
      }
    } catch (error) {
      console.error("載入管理員失敗:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">載入中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">管理員管理</h2>
        <button
          onClick={() => router.push("/admin/admins/new")}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          新增管理員
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳號</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">電子郵件</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">登入次數</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">上次登入</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {admins.map((admin) => (
              <tr key={admin.uid}>
                <td className="px-6 py-4 whitespace-nowrap">{admin.account}</td>
                <td className="px-6 py-4 whitespace-nowrap">{admin.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">{admin.displayName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{admin.loginCount || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString("zh-TW") : "从未"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => router.push(`/admin/admins/${admin.uid}`)}
                    className="text-blue-500 hover:text-blue-700 mr-3"
                  >
                    編輯
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
