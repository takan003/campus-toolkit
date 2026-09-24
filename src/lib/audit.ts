import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";

export type ActivityAction =
  | "login"
  | "login_failed"
  | "account_locked"
  | "logout"
  | "password_changed"
  | "settings_change"
  | "admin_created"
  | "admin_updated"
  | "admin_deleted";

export interface ActivityEntry {
  userId?: string;
  role?: string;
  action: ActivityAction;
  ip?: string;
  details?: string;
}

/**
 * 取得客戶端 IP。
 * 不採信 X-Forwarded-For 首段（客戶端可自行偽造）：
 * 優先使用平台／反向代理覆寫的 x-real-ip，否則取 XFF 最右段（由可信代理追加）。
 */
export function getClientIp(request: {
  headers: { get(name: string): string | null };
}): string {
  const real = request.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "";
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await getAdminDb().collection("activityLog").add({
      userId: entry.userId || "",
      role: entry.role || "",
      action: entry.action,
      timestamp: Date.now(),
      ip: entry.ip || "",
      details: entry.details || "",
    });
  } catch (error) {
    console.error("Activity log error:", error);
  }
}
