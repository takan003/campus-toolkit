/**
 * 主題市集伺服器端共用工具（比照模組市集 install/route.ts 的安全檢查模式）。
 *
 * 職責（協議 docs/PROTOCOL.md §6）：
 * - 市集來源 URL 解析（https 唯一，dev 例外放行 localhost）
 * - downloadUrl 安全檢查（hostname 必須與市集來源一致，防 SSRF）
 * - theme.json manifest 驗證
 * - styles.css token 白名單與值安全驗證
 * - minHostVersion 比較（主程式版本取自 src/version.json）
 */

import fs from "node:fs";
import path from "node:path";
import { THEME_COLOR_KEYS, REQUIRED_MARKET_THEME_KEYS } from "@/types/theme";

export const SUPPORTED_CONTRACT_VERSION = 1;

/** theme.json 上限（bytes） */
export const MAX_THEME_JSON_BYTES = 32 * 1024;

/** styles.css 上限（bytes）：純變數覆寫，遠小於此限 */
export const MAX_CSS_BYTES = 64 * 1024;

export interface ThemeManifest {
  id: string;
  name: string;
  version: string;
  themeId: string;
  minHostVersion: string;
  author: string;
  description: string;
  preview: string;
  category: string;
  tags: string[];
  contractVersion: number;
  cssFile: string;
}

export function resolveThemeMarketIndexUrl(): string | null {
  const candidate =
    process.env.THEME_MARKET_INDEX_URL?.trim() ||
    process.env.THEME_MARKET_URL?.trim() ||
    "";

  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    const isLocalhostDev =
      process.env.NODE_ENV === "development" &&
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");

    if (isLocalhostDev) {
      return parsed.toString();
    }

    if (parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveThemeMarketHost(): string | null {
  const marketUrl = resolveThemeMarketIndexUrl();
  if (!marketUrl) return null;
  try {
    return new URL(marketUrl).hostname;
  } catch {
    return null;
  }
}

/** downloadUrl 安全檢查：https 唯一（dev localhost 例外）＋主機必須＝市集來源主機 */
export function assertSafeThemeDownloadUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("downloadUrl 不是合法 URL");
  }

  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  const devLocalhostOk =
    process.env.NODE_ENV === "development" && url.protocol === "http:" && isLocalhost;
  if (!devLocalhostOk && url.protocol !== "https:") {
    throw new Error("downloadUrl 僅允許 https（本機開發可允 localhost http）");
  }

  const marketHost = resolveThemeMarketHost();
  if (!marketHost) {
    throw new Error("尚未設定 THEME_MARKET_INDEX_URL——無法核對下載來源主機，拒絕安裝");
  }
  if (url.hostname !== marketHost) {
    throw new Error(`downloadUrl 主機「${url.hostname}」與市集來源「${marketHost}」不一致，拒絕安裝`);
  }
  return url;
}

export function readHostVersion(): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "src", "version.json"), "utf-8");
    const parsed = JSON.parse(raw.replace(/^﻿/, "")) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim()) {
      return parsed.version.trim();
    }
  } catch {
    // fall through
  }
  return "0.0.0";
}

function versionParts(version: string): number[] {
  return version
    .split(".")
    .map((part) => {
      const digits = part.match(/^\d+/);
      return digits ? Number.parseInt(digits[0], 10) : 0;
    })
    .slice(0, 3);
}

/** current >= min（semver 數值比較，缺段補 0；比對不合法時回 false＝拒絕） */
export function versionAtLeast(current: string, min: string): boolean {
  if (!/^\d+\.\d+\.\d+$/.test(current) || !/^\d+\.\d+\.\d+$/.test(min)) {
    return false;
  }
  const a = versionParts(current);
  const b = versionParts(min);
  for (let i = 0; i < 3; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return true;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

/** theme.json manifest 驗證（契約 theme.schema.json ＋ §6-8） */
export function validateThemeManifest(raw: unknown, expectedId: string): ThemeManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("theme.json 格式錯誤");
  }
  const manifest = raw as Record<string, unknown>;

  const id = readString(manifest.id);
  const name = readString(manifest.name);
  const version = readString(manifest.version);
  const themeId = readString(manifest.themeId);
  const minHostVersion = readString(manifest.minHostVersion);
  const author = readString(manifest.author);
  const description = readString(manifest.description) ?? "";
  const preview = readString(manifest.preview);
  const category = readString(manifest.category);
  const cssFile = readString(manifest.cssFile);

  if (!id || !name || !version || !themeId || !minHostVersion || !author || !preview || !cssFile) {
    throw new Error("theme.json 缺少必要欄位（id/name/version/themeId/minHostVersion/author/preview/cssFile）");
  }
  if (id !== expectedId) {
    throw new Error(`theme.json 的 id（${id}）與安裝請求（${expectedId}）不一致，拒絕安裝`);
  }
  if (themeId !== `market:${id}`) {
    throw new Error(`themeId 必須為 market:${id}（實際為 ${themeId}），拒絕安裝`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^\d+\.\d+\.\d+$/.test(minHostVersion)) {
    throw new Error("version / minHostVersion 必須為 semver（x.y.z）");
  }
  if (category !== "theme") {
    throw new Error("category 必須為 theme");
  }
  if (!/^\d+$/.test(String(manifest.contractVersion))) {
    throw new Error("contractVersion 必須為整數");
  }
  const contractVersion = Number.parseInt(String(manifest.contractVersion), 10);
  if (contractVersion !== SUPPORTED_CONTRACT_VERSION) {
    throw new Error(`不支援的 contractVersion（${contractVersion}，本主程式支援 ${SUPPORTED_CONTRACT_VERSION}）`);
  }
  if (!/^[A-Za-z0-9._-]+\.css$/.test(cssFile)) {
    throw new Error(`cssFile 檔名不合法：${cssFile}`);
  }

  const tags = Array.isArray(manifest.tags)
    ? manifest.tags
        .map((tag) => readString(tag))
        .filter((tag): tag is string => tag !== null)
    : [];

  return {
    id,
    name,
    version,
    themeId,
    minHostVersion,
    author,
    description,
    preview,
    category,
    tags,
    contractVersion,
    cssFile,
  };
}

const UNSAFE_VALUE_PATTERN = /[;{}]|url\(|expression\(|@import|<|\\|\*\//i;

/** token 值安全驗證：僅允許安全的 CSS 宣告值（契約 §6-9） */
export function assertSafeThemeColorValue(key: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${key} 的值不得為空`);
  }
  if (trimmed.length > 160) {
    throw new Error(`${key} 的值過長（超過 160 字元）`);
  }
  if (UNSAFE_VALUE_PATTERN.test(trimmed)) {
    throw new Error(`${key} 的值含不允許的構造（分號／花括號／url()/expression() 等），拒絕安裝`);
  }
  if (!/^[\w\s(),.%/#'-]+$/.test(trimmed)) {
    throw new Error(`${key} 的值含不允許的字元，拒絕安裝`);
  }
  return trimmed;
}

/**
 * styles.css token 解析（契約 §5.2/§5.3）：
 * - 必須恰好含一個 html[data-theme="market:{id}"] 區塊，且檔案中不得有其他規則
 * - 鍵必須屬於 THEME_COLOR_KEYS 白名單
 * - 值必須通過 assertSafeThemeColorValue
 */
export function parseThemeCssVariables(css: string, themeId: string): Record<string, string> {
  const escaped = themeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockPattern = new RegExp(
    `html\\[data-theme=["']${escaped}["']\\]\\s*\\{([^}]*)\\}`,
    "i"
  );
  const match = blockPattern.exec(css);
  if (!match) {
    throw new Error(`styles.css 缺少 html[data-theme="${themeId}"] 變數區塊，拒絕安裝`);
  }

  const remainder = css.replace(blockPattern, "").trim();
  if (remainder.replace(/\/\*[\s\S]*?\*\//g, "").trim()) {
    throw new Error("styles.css 只允許單一 html[data-theme] 變數覆寫區塊（不得含元件規則），拒絕安裝");
  }

  const body = match[1] ?? "";
  const declarationPattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  const colors: Record<string, string> = {};
  let declared: RegExpExecArray | null;
  while ((declared = declarationPattern.exec(body)) !== null) {
    const key = declared[1]!.toLowerCase();
    if (!(THEME_COLOR_KEYS as readonly string[]).includes(key)) {
      throw new Error(`styles.css 含非白名單 token「${key}」，拒絕安裝（白名單見市集契約 §5.1）`);
    }
    colors[key] = assertSafeThemeColorValue(key, declared[2] ?? "");
  }

  for (const requiredKey of REQUIRED_MARKET_THEME_KEYS) {
    if (!(requiredKey in colors)) {
      throw new Error(`styles.css 缺少必填 token「${requiredKey}」，拒絕安裝`);
    }
  }

  return colors;
}
