import { UserRole, ROLE_HOME, isUserRole } from "@/types/users";

export interface UserSession {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  role: UserRole;
  loginTime?: number;
}

export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !isUserRole(parsed.role)) return null;
    return parsed as UserSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("user_session");
}

export function getHomePath(role: UserRole): string {
  return ROLE_HOME[role];
}
