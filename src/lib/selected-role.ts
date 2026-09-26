import { isUserRole, UserRole } from "@/types/users";

/**
 * 目前選擇的身分（登入頁 ↔ 忘記密碼頁 共用）。
 * 存在 localStorage，讓使用者在兩個頁面之間往返時選擇不會被重置。
 */
const SELECTED_ROLE_STORAGE_KEY = "campusToolkitSelectedRole";

export function readSelectedRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(SELECTED_ROLE_STORAGE_KEY);
    return isUserRole(saved) ? saved : null;
  } catch {
    // 無法存取 localStorage（隱私模式／被停用）時視為未選擇
    return null;
  }
}

export function saveSelectedRole(role: UserRole): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_ROLE_STORAGE_KEY, role);
  } catch {
    // 寫入失敗不影響功能，僅下次需重新選擇
  }
}
