/**
 * API catch 統一訊息：開發環境或設定類錯誤回傳真實原因，其餘維持安全預設字串。
 */
export function serverErrorMessage(error: unknown, fallback: string): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (process.env.NODE_ENV !== "production") return msg;

  if (
    msg.includes("FIREBASE_SERVICE_ACCOUNT_KEY") ||
    msg.includes("Firebase Admin SDK") ||
    msg.includes("SEED_") ||
    msg.includes("ALLOW_BOOTSTRAP_ADMIN")
  ) {
    return msg;
  }

  return fallback;
}
