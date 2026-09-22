import type { Metadata } from "next";
import "@/styles/globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "數位校園工具箱",
  description: "整合校園資訊、選課、公告、社團等功能的綜合性校園工具平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6708300535856225"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
