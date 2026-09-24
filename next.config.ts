import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// CSP（含 script-src nonce）由 src/proxy.ts 動態產出；
// 此處僅保留不需 per-request nonce 的固定安全標頭。
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // 阻斷跨來源文件以 window.opener 存取本頁（COOP），
  // 限制本站資源被跨來源嵌入（CORP），並禁止 Flash 等讀取本域 cross-domain policy 檔
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
