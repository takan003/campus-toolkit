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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
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
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("user_session");
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">載入中...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航列 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold">管理後台</h1>
            <span className="text-sm text-gray-500">
              {user.displayName || user.account}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700"
          >
            登出
          </button>
        </div>
      </nav>

      {/* 主要內容 */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
