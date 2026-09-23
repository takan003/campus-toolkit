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

export function isStrongPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8;
}
