/**
 * 主題本體的瀏覽器端儲存層（Step 9）。
 *
 * 主程式部署於 Vercel、production 檔案系統唯讀，因此安裝紀錄不走檔案系統：
 * - 主題內容（token colors）→ localStorage `campusTheme_{themeId}`
 * - 已安裝清單 → localStorage `campusThemeInstalled`
 * - 帳號層 themeId 同步為 Phase 4（users.cssThemeId），本層先負責本機快取
 *
 * 鍵名為歷史命名（與早期 CSS 主題規劃一致），既有使用者快取相容，勿任意變更：
 * - 主題內容 → localStorage `campusTheme_{themeId}`
 * - 已安裝清單 → localStorage `campusThemeInstalled`
 */

import { Theme, ThemeColors, THEME_COLOR_KEYS } from "@/types/theme";
import { defaultTheme } from "@/lib/themes";

const INSTALLED_KEY = "campusThemeInstalled";
const THEME_PREFIX = "campusTheme_";

export interface InstalledThemeRecord {
  id: string;
  name: string;
  version: string;
  source: "market" | "custom";
  installedAt: string;
}

interface StoredThemePayload {
  id: string;
  name: string;
  version: string;
  colors: Record<string, string>;
  preview?: string;
}

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function listInstalledThemes(): InstalledThemeRecord[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(INSTALLED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is InstalledThemeRecord =>
        !!item &&
        typeof item === "object" &&
        typeof (item as InstalledThemeRecord).id === "string" &&
        typeof (item as InstalledThemeRecord).name === "string"
    );
  } catch {
    return [];
  }
}

function sanitizeColors(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const colors: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(THEME_COLOR_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value !== "string" || !value.trim() || value.length > 160) continue;
    if (/[;{}]|url\(|expression\(/i.test(value)) continue;
    colors[key] = value.trim();
  }
  return Object.keys(colors).length > 0 ? colors : null;
}

/** 讀取已安裝主題（market:/custom:），格式不合法時回 null */
export function readStoredTheme(id: string): Theme | null {
  if (!isStorageAvailable()) return null;
  if (!id.startsWith("market:") && !id.startsWith("custom:")) return null;
  try {
    const raw = localStorage.getItem(THEME_PREFIX + id);
    if (!raw) return null;
    const payload = JSON.parse(raw) as StoredThemePayload;
    if (!payload || typeof payload !== "object" || payload.id !== id) return null;
    const colors = sanitizeColors(payload.colors);
    if (!colors) return null;
    return {
      id,
      name: typeof payload.name === "string" && payload.name ? payload.name : id,
      colors: { ...defaultTheme.colors, ...colors } as ThemeColors,
      preview:
        typeof payload.preview === "string" && payload.preview
          ? payload.preview
          : colors["--bg"] ?? defaultTheme.preview,
    };
  } catch {
    return null;
  }
}

export function isThemeInstalled(id: string): boolean {
  return listInstalledThemes().some((item) => item.id === id);
}

/** 安裝／更新主題（安裝路由驗證通過後由前端呼叫） */
export function saveInstalledTheme(
  record: InstalledThemeRecord,
  theme: Pick<Theme, "colors" | "preview">
): void {
  if (!isStorageAvailable()) return;

  const payload: StoredThemePayload = {
    id: record.id,
    name: record.name,
    version: record.version,
    colors: theme.colors as unknown as Record<string, string>,
    preview: theme.preview,
  };
  localStorage.setItem(THEME_PREFIX + record.id, JSON.stringify(payload));

  const others = listInstalledThemes().filter((item) => item.id !== record.id);
  localStorage.setItem(INSTALLED_KEY, JSON.stringify([...others, record]));
}

export function removeInstalledTheme(id: string): void {
  if (!isStorageAvailable()) return;
  localStorage.removeItem(THEME_PREFIX + id);
  localStorage.setItem(
    INSTALLED_KEY,
    JSON.stringify(listInstalledThemes().filter((item) => item.id !== id))
  );
}

/* ------------------------------------------------------------------ */
/* 市集內容取回與帳號同步（Step 11：跨裝置還原與 themeId 同步）            */
/* ------------------------------------------------------------------ */

export interface ThemeAccountPrefs {
  cssThemeId: string;
  installedThemes: InstalledThemeRecord[];
}

/** 從主程式內容端點取回 market: 主題（伺服器已驗證 checksum／契約），存入本機快取 */
export async function ensureMarketTheme(id: string): Promise<Theme | null> {
  if (!id.startsWith("market:")) return null;
  const existing = readStoredTheme(id);
  if (existing) return existing;

  const shortId = id.slice("market:".length);
  try {
    const response = await fetch(`/api/market/themes/${encodeURIComponent(shortId)}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      success?: boolean;
      themeId?: string;
      theme?: { name?: string; version?: string };
      colors?: Record<string, string>;
      preview?: string;
      message?: string;
    };
    if (!response.ok || !data.success || !data.themeId || !data.colors) {
      return null;
    }
    const sanitized = sanitizeColors(data.colors);
    if (!sanitized) return null;

    saveInstalledTheme(
      {
        id: data.themeId,
        name: typeof data.theme?.name === "string" ? data.theme.name : shortId,
        version: typeof data.theme?.version === "string" ? data.theme.version : "1.0.0",
        source: "market",
        installedAt: new Date().toISOString(),
      },
      {
        colors: { ...defaultTheme.colors, ...sanitized } as ThemeColors,
        preview: data.preview || sanitized["--bg"] || defaultTheme.preview,
      }
    );
    return readStoredTheme(data.themeId);
  } catch {
    return null;
  }
}

/** 讀取帳號主題偏好（未登入或失敗回 null） */
export async function fetchAccountThemePrefs(): Promise<ThemeAccountPrefs | null> {
  try {
    const response = await fetch("/api/me/theme", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      success?: boolean;
      cssThemeId?: string;
      installedThemes?: InstalledThemeRecord[];
    };
    if (!data.success) return null;
    return {
      cssThemeId: typeof data.cssThemeId === "string" ? data.cssThemeId : "",
      installedThemes: Array.isArray(data.installedThemes) ? data.installedThemes : [],
    };
  } catch {
    return null;
  }
}

/** 儲存目前主題 id 到帳號（防抖由呼叫端處理；失敗靜默——本機快取仍在） */
export async function saveAccountThemeId(themeId: string): Promise<void> {
  try {
    await fetch("/api/me/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeId }),
    });
  } catch {
    // 離線或未登入時忽略；本機 localStorage 仍保留選擇
  }
}

/** 把本機已安裝清單同步到帳號（安裝／卸載後呼叫） */
export async function syncInstalledThemesToAccount(): Promise<void> {
  try {
    await fetch("/api/me/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installedThemes: listInstalledThemes() }),
    });
  } catch {
    // 同上，靜默失敗
  }
}
