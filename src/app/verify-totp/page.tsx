import TwoFactorVerify from "@/components/TwoFactorVerify";

/** 兩階段驗證：驗證碼 APP（TOTP）頁（帳密通過後的第二階段） */
export default function VerifyTotpPage() {
  return <TwoFactorVerify mode="totp" />;
}
