"use client";

import { ReactNode } from "react";
import AdminSectionShell from "@/components/AdminSectionShell";

/**
 * 「主題市集」共用外殼（標題、權限閘門、頁尾）。
 * themeMarket 為超級專屬權限模組（scope＝superOnly），
 * 頁面層以 AdminSectionShell 閘門，API 層另以
 * requireAdminModule("themeMarket")＋isSuperAdmin 把關。
 */
export default function ThemeMarketLayout({ children }: { children: ReactNode }) {
  return (
    <AdminSectionShell
      moduleKey="themeMarket"
      title="主題市集"
      description="瀏覽外部主題市集的 CSS 主題並一鍵安裝；安裝前自動驗證 checksum、主機版本與下載來源。"
      deniedMessage="「主題市集」僅超級管理員可使用。若顯示此訊息但您具超級屬性，代表權限資料讀取失敗，請重新整理。"
    >
      {children}
    </AdminSectionShell>
  );
}
