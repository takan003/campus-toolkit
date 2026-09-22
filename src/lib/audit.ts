import "server-only";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ActivityAction =
  | "login"
  | "login_failed"
  | "account_locked"
  | "logout"
  | "password_changed"
  | "settings_change"
  | "admin_created";

export interface ActivityEntry {
  userId?: string;
  role?: string;
  action: ActivityAction;
  ip?: string;
  details?: string;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "";
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await addDoc(collection(db, "activityLog"), {
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
