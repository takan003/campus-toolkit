import "server-only";
import nodemailer, { Transporter } from "nodemailer";

/**
 * SMTP 寄信模組（Gmail 應用程式密碼 / 任何 SMTP 服務皆可）。
 * 必要環境變數：
 *   SMTP_HOST  例如 smtp.gmail.com
 *   SMTP_USER  寄信帳號
 *   SMTP_PASS  應用程式密碼（Google 帳號 → 登入與安全性 → 應用程式密碼）
 * 選用：
 *   SMTP_PORT  預設 465（SMTP_SECURE=true 時）或 587
 *   SMTP_SECURE "true"/"false"，未設時以 port===465 判斷
 *   SMTP_FROM  寄件者顯示名稱，預設 "數位校園工具箱 <SMTP_USER>"
 */

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

let transportPromise: Promise<Transporter> | null = null;

async function getTransport(): Promise<Transporter> {
  if (!transportPromise) {
    transportPromise = (async () => {
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!host || !user || !pass) {
        throw new Error("SMTP 環境變數未設定（SMTP_HOST / SMTP_USER / SMTP_PASS）");
      }
      const port = Number(process.env.SMTP_PORT) || (process.env.SMTP_SECURE === "false" ? 587 : 465);
      const secure =
        process.env.SMTP_SECURE !== undefined
          ? process.env.SMTP_SECURE === "true"
          : port === 465;

      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        // 校園 Gmail 常見需要；其他 SMTP 若不支援 STARTTLS 會被忽略
        requireTLS: secure || port === 587,
      });
    })();
    // 設定錯誤時清除快取，讓修正環境變數後不需重啟
    transportPromise.catch(() => {
      transportPromise = null;
    });
  }
  return transportPromise;
}

/** 跳脫使用者可控字串，避免 displayName / 學校名稱夾帶 HTML 造成信件注入 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PasswordResetMailOptions {
  /** 收件人（已正規化的電子郵件） */
  to: string;
  /** 收件人顯示名稱，可為空 */
  displayName?: string;
  /** 一次性重設連結（含 token） */
  resetUrl: string;
  /** 有效期限（分鐘） */
  expiresMinutes: number;
  /** 信件抬頭用的系統／學校名稱 */
  siteName?: string;
}

export async function sendPasswordResetEmail(
  options: PasswordResetMailOptions
): Promise<void> {
  const transport = await getTransport();
  const from =
    process.env.SMTP_FROM?.trim() ||
    `${options.siteName || "數位校園工具箱"} <${process.env.SMTP_USER}>`;

  const siteName = options.siteName || "數位校園工具箱";
  const greeting = options.displayName ? `${options.displayName} 您好` : "您好";
  const resetUrl = escapeHtml(options.resetUrl);
  const expiresMinutes = escapeHtml(String(options.expiresMinutes));

  const text = [
    `${greeting}：`,
    "",
    `我們收到 ${siteName} 的密碼重設請求。`,
    `請在 ${options.expiresMinutes} 分鐘內點擊以下連結設定新密碼：`,
    options.resetUrl,
    "",
    `連結將於 ${options.expiresMinutes} 分鐘後失效，且僅能使用一次。`,
    "若非本人操作，請忽略這封信件，您的密碼不會被變更。",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,'Segoe UI','Noto Sans TC',Arial,sans-serif;color:#1f2328;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 4px;font-size:20px;">${escapeHtml(siteName)}</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">密碼重設信件</p>
    <p style="margin:0 0 16px;font-size:15px;">${escapeHtml(greeting)}：</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">
      我們收到您的密碼重設請求。請在 <strong>${expiresMinutes} 分鐘</strong>內點擊下方按鈕設定新密碼。
    </p>
    <p style="margin:0 0 24px;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;">
        重設密碼
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.7;">
      連結將於 ${expiresMinutes} 分鐘後失效，且僅能使用一次。<br />
      若按鈕無法點擊，請複製以下網址至瀏覽器開啟：<br />
      <span style="word-break:break-all;color:#2563eb;">${resetUrl}</span>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      若非本人操作，請忽略這封信件，您的密碼不會被變更。
    </p>
  </div>
</body>
</html>`.trim();

  await transport.sendMail({
    from,
    to: options.to,
    subject: `【${siteName}】密碼重設（${options.expiresMinutes} 分鐘內有效）`,
    text,
    html,
  });
}
