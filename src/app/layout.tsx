import type { Metadata } from "next";
import "@/styles/globals.css";

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
      <body>{children}</body>
    </html>
  );
}
