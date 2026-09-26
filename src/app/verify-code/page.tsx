import TwoFactorVerify from "@/components/TwoFactorVerify";

/** 兩階段驗證：電子郵件驗證碼頁（帳密通過後的第二階段） */
export default function VerifyCodePage() {
  return <TwoFactorVerify mode="email_otp" />;
}
