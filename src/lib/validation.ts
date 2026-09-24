export function clampCostFactor(value: unknown, fallback = 12): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  if (rounded < 4) return 4;
  if (rounded > 15) return 15;
  return rounded;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.toLowerCase().trim();
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export function normalizeAccount(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const account = value.toLowerCase().trim();
  if (!account || account.length < 2 || account.length > 64) return null;
  if (!/^[a-z0-9._@-]+$/.test(account)) return null;
  return account;
}

const COMMON_WEAK_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "passw0rd",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "admin123",
  "letmein1",
  "welcome1",
  "abc12345",
  "11111111",
  "00000000",
  "aaaaaaaa",
]);

/**
 * 密碼強度：至少 8 碼、至少兩種字元類別（字母／數字／符號）、擋常見弱密碼。
 * 客戶端與伺服器共用此檢查，兩側訊息需一致。
 */
export function isStrongPassword(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 8 || value.length > 128) return false;
  if (COMMON_WEAK_PASSWORDS.has(value.toLowerCase())) return false;

  const hasLetter = /[a-zA-Z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSymbol = /[^a-zA-Z0-9]/.test(value);
  const classes = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length;
  return classes >= 2;
}

export const PASSWORD_REQUIREMENT_MESSAGE = "密碼至少 8 碼，且需包含字母與數字";
