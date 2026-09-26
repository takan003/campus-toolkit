/* eslint-disable no-console */
// 暫時性 SMTP 連線測試：node --env-file=.env.local scripts/smtp-test.mjs
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error("缺少 SMTP_HOST / SMTP_USER / SMTP_PASS");
  process.exit(1);
}

const port = Number(SMTP_PORT) || 465;
const secure = port === 465;

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  requireTLS: !secure,
});

try {
  console.log(`連線 ${SMTP_HOST}:${port} 並驗證帳號...`);
  await transport.verify();
  console.log("✅ SMTP 連線與帳號驗證成功");

  const info = await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: SMTP_USER,
    subject: "【數位校園工具箱】SMTP 測試信",
    text:
      "這是一封測試信，用來確認「忘記密碼」寄信功能的 SMTP 設定。\n" +
      "收到這封信代表寄信設定成功。\n",
  });
  console.log("✅ 測試信已寄出:", info.messageId);
} catch (error) {
  console.error("❌ 失敗:", error.message);
  if (error.response) console.error("伺服器回應:", error.response);
  process.exitCode = 1;
} finally {
  transport.close();
}
