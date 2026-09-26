"use client";

import { useRouter } from "next/navigation";
import AccountSecurity from "@/components/AccountSecurity";

export default function AdminAccountPage() {
  const router = useRouter();

  return (
    <AccountSecurity role="admin">
      {/* 管理員帳號維護（新增管理員） */}
      <div className="w-full max-w-2xl border border-themed rounded-lg p-6 mb-4">
        <h3 className="font-bold text-t1 mb-4">管理員帳號</h3>
        <p className="text-sm text-t3 mb-4">
          需要新增其他系統管理員時，可由此建立具備完整管理權限的帳號。
        </p>
        <button
          onClick={() => router.push("/admin/admins/new")}
          className="btn-theme rounded-lg px-4 py-2 text-sm cursor-pointer"
        >
          新增管理員
        </button>
      </div>
    </AccountSecurity>
  );
}
