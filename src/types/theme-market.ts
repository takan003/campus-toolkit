/**
 * 主題市集索引契約（對應市集 repo 的 docs/PROTOCOL.md §4.1）。
 * 解析規則比照模組市集（types/module-market.ts）：只驗必填字串，
 * checksum／URL／版本安全檢查在安裝路由強制執行。
 */

export interface ThemeMarketEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  latestVersion?: string;
  minHostVersion?: string;
  repoUrl?: string;
  downloadUrl?: string;
  checksumSha256?: string;
  category?: string;
  tags?: string[];
}

export interface ThemeMarketIndex {
  generatedAt?: string;
  marketplaceVersion?: string;
  themes: ThemeMarketEntry[];
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value
    .map((item) => readString(item))
    .filter((item): item is string => item !== null);
  return arr.length > 0 ? arr : undefined;
}

export function parseThemeMarketEntry(value: unknown): ThemeMarketEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const id = readString(entry.id);
  const name = readString(entry.name);
  const version = readString(entry.version);

  if (!id || !name || !version) {
    return null;
  }

  return {
    id,
    name,
    description: readString(entry.description) ?? "",
    version,
    latestVersion: readString(entry.latestVersion) ?? version,
    minHostVersion: readString(entry.minHostVersion) ?? undefined,
    repoUrl: readString(entry.repoUrl) ?? undefined,
    downloadUrl: readString(entry.downloadUrl) ?? undefined,
    checksumSha256: readString(entry.checksumSha256) ?? undefined,
    category: readString(entry.category) ?? undefined,
    tags: readStringArray(entry.tags),
  };
}

/**
 * 解析市集索引。契約規定 category 固定為 "theme"（市集 repo 只發佈主題），
 * 缺少 category 的條目一律過濾，避免模組條目混入主題市集。
 */
export function parseThemeMarketIndex(value: unknown): ThemeMarketIndex | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const index = value as Record<string, unknown>;
  const rawModules = Array.isArray(index.modules) ? index.modules : [];
  const themes = rawModules
    .map((item) => parseThemeMarketEntry(item))
    .filter((item): item is ThemeMarketEntry => item !== null && item.category === "theme");

  return {
    generatedAt: readString(index.generatedAt) ?? undefined,
    marketplaceVersion: readString(index.marketplaceVersion) ?? undefined,
    themes,
  };
}
