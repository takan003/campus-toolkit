import { UserRole, ROLE_HOME, isUserRole } from "@/types/users";

export interface UserSession {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  role: UserRole;
}

let cached: UserSession | null = null;
let checked = false;
let inFlight: Promise<UserSession | null> | null = null;

function toUserSession(user: unknown): UserSession | null {
  if (!user || typeof user !== "object") return null;
  const u = user as Record<string, unknown>;
  if (!isUserRole(u.role) || typeof u.uid !== "string" || !u.uid) return null;
  return {
    uid: u.uid,
    email: typeof u.email === "string" ? u.email : "",
    account: typeof u.account === "string" ? u.account : "",
    displayName: typeof u.displayName === "string" ? u.displayName : "",
    role: u.role,
  };
}

export function getCachedSession(): UserSession | null {
  return cached;
}

export async function fetchSession(force = false): Promise<UserSession | null> {
  if (!force && checked && !inFlight) return cached;
  if (inFlight && !force) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        cached = toUserSession(data.user);
      } else {
        cached = null;
      }
    } catch {
      cached = null;
    } finally {
      checked = true;
      inFlight = null;
    }
    return cached;
  })();

  return inFlight;
}

export function setCachedSession(user: UserSession): void {
  cached = user;
  checked = true;
}

export function clearSession(): void {
  cached = null;
  checked = true;
}

export async function logout(): Promise<void> {
  clearSession();
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // cookie 可能已過期，忽略網路錯誤
  }
}

export function getHomePath(role: UserRole): string {
  return ROLE_HOME[role];
}
