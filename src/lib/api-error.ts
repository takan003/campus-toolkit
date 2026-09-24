/**
 * API catch 統一訊息：開發環境回傳真實原因以便除錯；
 * production 一律回傳固定的 fallback（安全中文），錯誤細節只留在伺服器 log。
 */
export function serverErrorMessage(error: unknown, fallback: string): string {
  if (process.env.NODE_ENV !== "production") {
    return error instanceof Error ? error.message : String(error);
  }
  return fallback;
}
