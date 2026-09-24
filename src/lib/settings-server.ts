import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import { defaultSettings } from "@/types/settings";

const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC_ID = "system";
const CACHE_TTL_MS = 30_000;

let timeoutCache: { minutes: number; at: number } | null = null;

/** 設定儲存後呼叫，讓閒置逾時快取立即失效 */
export function invalidateSettingsCache(): void {
  timeoutCache = null;
}

/**
 * 讀取 settings.sessionTimeout（分鐘），供伺服器端閒置逾時檢查使用。
 * 以 30 秒 in-process 快取避免每個請求都打 Firestore；讀失敗時回退上次值或預設值。
 */
export async function getSessionTimeoutMinutes(): Promise<number> {
  const now = Date.now();
  if (timeoutCache && now - timeoutCache.at < CACHE_TTL_MS) return timeoutCache.minutes;

  try {
    const snap = await getAdminDb()
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC_ID)
      .get();
    const raw = snap.exists
      ? (snap.data() as Record<string, unknown> | undefined)?.sessionTimeout
      : undefined;
    const minutes = Number(raw);
    const value =
      Number.isFinite(minutes) && minutes >= 1 ? minutes : defaultSettings.sessionTimeout;
    timeoutCache = { minutes: value, at: now };
    return value;
  } catch (error) {
    console.error("Session timeout settings read error:", error);
    if (timeoutCache) return timeoutCache.minutes;
    return defaultSettings.sessionTimeout;
  }
}
