import type { Metadata } from "next";
import { headers } from "next/headers";
import "@/styles/globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "數位校園工具箱",
  description: "整合校園資訊、選課、公告、社團等功能的綜合性校園工具平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 讀取 proxy 產生的請求標頭以強制 root layout 走動態渲染：
  // nonce CSP 要求每次請求重新渲染，Next 框架內聯 script 才能帶上對應 nonce。
  // AdSense script 已移入 AdSense 元件，僅在 sponsorAdEnabled 時才掛載。
  await headers();

  return (
    <html lang="zh-TW">
      <head />
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
