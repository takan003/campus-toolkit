"use client";

import { useEffect, useState } from "react";
import { fetchSession, UserSession } from "@/lib/session";
import ThemeSubmissionForm from "@/components/ThemeSubmissionForm";

/**
 * 使用者主題投稿頁（§21）：任何已登入身分皆可送出主題投稿（token JSON），
 * 經管理員審核（draft PR → merge）後上架市集。
 */
export default function ThemeSubmitPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchSession(true).then((current) => {
      if (cancelled) return;
      if (!current) {
        window.location.href = "/";
        return;
      }
      setSession(current);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-t3">
        檢查登入狀態中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-t1">投稿我的 CSS 主題</h1>
          <p className="mt-1 text-sm text-t3">
            調好色票後送出，系統會為您建立草稿 PR；管理員審核通過 merge 後，主題就會上架到市集，
            讓全校的人都能安裝使用。送出前可先在右上角主題選單用「自訂」方式試色。
          </p>
        </div>

        <div className="border border-themed rounded-lg bg-card p-6">
          <ThemeSubmissionForm endpoint="/api/market/submit" submitLabel="送出投稿（審核後上架）" />
        </div>

        <p className="text-xs text-t3">
          規則：只收 token JSON（系統白名單），不收自由 CSS；id 需未與現有市集主題重複；
          每小時最多 5 次投稿。詳見市集倉庫 docs/PROTOCOL.md 第 11 章。
        </p>
      </div>
    </div>
  );
}
