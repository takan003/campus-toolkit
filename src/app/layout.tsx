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
  // 讀取 proxy 產生的 nonce：套用到 AdSense script，同時讓 root layout 走動態渲染
  // （nonce CSP 要求每次請求重新渲染，框架 script 才能帶上 nonce）
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="zh-TW">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6708300535856225"
          crossOrigin="anonymous"
          nonce={nonce}
        />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
