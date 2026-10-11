import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { isSuperAdmin, requireAdminModule, toAuthResponse } from "@/lib/dal";
import { assertSameOrigin } from "@/lib/csrf";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { getClientIp, logActivity } from "@/lib/audit";
import { defaultTheme } from "@/lib/themes";
import {
  MAX_CSS_BYTES,
  MAX_THEME_JSON_BYTES,
  assertSafeThemeDownloadUrl,
  parseThemeCssVariables,
  readHostVersion,
  validateThemeManifest,
  versionAtLeast,
} from "@/lib/theme-market";
import { ThemeColors } from "@/types/theme";

export const dynamic = "force-dynamic";

/**
 * 主題套件下載上限（bytes）：契約 §6-6 建議預設 5MB。
 * 主題包極小（theme.json＋純變數 styles.css），此上限已含大量緩衝。
 */
const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;

/** 解壓後總大小／檔案數上限（zip slip 與解壓炸彈防護） */
const MAX_EXTRACTED_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 64;

function assertInsideDir(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("壓縮檔含路徑穿越（zip slip），拒絕安裝");
  }
}

function walkExtracted(root: string): { totalBytes: number; fileCount: number } {
  let totalBytes = 0;
  let fileCount = 0;

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      assertInsideDir(root, full);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        fileCount += 1;
        if (fileCount > MAX_EXTRACTED_FILES) {
          throw new Error(`主題包檔案數過多（超過 ${MAX_EXTRACTED_FILES} 個），拒絕安裝`);
        }
        totalBytes += fs.statSync(full).size;
        if (totalBytes > MAX_EXTRACTED_BYTES) {
          throw new Error(`主題包解壓後過大（超過 ${MAX_EXTRACTED_BYTES / 1024 / 1024}MB），拒絕安裝`);
        }
      }
    }
  }

  walk(root);
  return { totalBytes, fileCount };
}

async function downloadToTemp(downloadUrl: string): Promise<{ filePath: string; sha256: string }> {
  const url = assertSafeThemeDownloadUrl(downloadUrl);
  if (!url.pathname.toLowerCase().endsWith(".zip")) {
    throw new Error("主題下載檔必須為 .zip");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "campus-theme-market-"));
  const filePath = path.join(tempDir, "theme.zip");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: controller.signal, redirect: "error" });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`下載失敗（HTTP ${response.status}）`);
  }

  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_ARCHIVE_BYTES) {
    throw new Error(`主題套件過大（超過 ${MAX_ARCHIVE_BYTES / 1024 / 1024}MB 上限）`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`主題套件過大（超過 ${MAX_ARCHIVE_BYTES / 1024 / 1024}MB 上限）`);
  }
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filePath, buffer);
  return {
    filePath,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

function extractArchive(filePath: string): string {
  const dir = path.join(path.dirname(filePath), "extracted");
  fs.mkdirSync(dir, { recursive: true });

  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -Path '${filePath}' -DestinationPath '${dir}' -Force`,
      ],
      { encoding: "utf-8" }
    );
    if (result.status !== 0) {
      throw new Error(result.stderr?.toString() || "ZIP 解壓失敗");
    }
  } else {
    const result = spawnSync("unzip", ["-q", filePath, "-d", dir], { encoding: "utf-8" });
    if (result.status !== 0) {
      throw new Error(result.stderr?.toString() || "ZIP 解壓失敗");
    }
  }

  walkExtracted(dir);
  return dir;
}

function findThemeManifestRoot(sourceDir: string): string {
  const manifestPath = path.join(sourceDir, "theme.json");
  if (fs.existsSync(manifestPath)) return sourceDir;

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (fs.existsSync(path.join(sourceDir, entry.name, "theme.json"))) {
      return path.join(sourceDir, entry.name);
    }
  }

  throw new Error("主題包中未找到 theme.json");
}

/**
 * 主題安裝（Step 8，協議 §6 全套安全檢查）。
 *
 * 與模組安裝的關鍵差異：主題是純資料（JSON＋CSS），不寫入 repo 的 src/ 目錄，
 * 只寫伺服器暫存目錄並回傳驗證後的主題內容——因此 production（Vercel 檔案系統唯讀）
 * 也能安裝；主題內容由前端存入 localStorage，帳號層 themeId 另由使用者設定同步。
 */
export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const limited = enforceRateLimit(
      request,
      "theme-market",
      RATE.THEME_MARKET_MUTATE.limit,
      RATE.THEME_MARKET_MUTATE.windowMs
    );
    if (limited) return limited;

    const { session, denial } = await requireAdminModule("themeMarket");
    if (denial) return toAuthResponse(denial);

    if (!(await isSuperAdmin(session))) {
      return NextResponse.json(
        { success: false, message: "僅超級管理員可安裝主題" },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const themeId = typeof body.id === "string" ? body.id.trim() : "";
    const downloadUrl = typeof body.downloadUrl === "string" ? body.downloadUrl.trim() : "";
    const expectedSha256 =
      typeof body.checksumSha256 === "string" ? body.checksumSha256.trim().toLowerCase() : "";
    const expectedVersion = typeof body.version === "string" ? body.version.trim() : "";

    if (!themeId) {
      return NextResponse.json({ success: false, message: "缺少主題 id" }, { status: 400 });
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(themeId)) {
      return NextResponse.json({ success: false, message: "主題 id 格式不合法" }, { status: 400 });
    }
    if (!downloadUrl) {
      return NextResponse.json(
        { success: false, message: "缺少 downloadUrl（主題安裝只接受市集下載）" },
        { status: 400 }
      );
    }
    if (!expectedSha256 || !/^[0-9a-f]{64}$/.test(expectedSha256)) {
      return NextResponse.json(
        { success: false, message: "checksumSha256 需為 64 碼小寫十六進位（契約 §6-4）" },
        { status: 400 }
      );
    }

    const downloaded = await downloadToTemp(downloadUrl);
    if (downloaded.sha256 !== expectedSha256) {
      throw new Error("套件完整性校驗失敗（sha256 不符）——拒絕安裝");
    }

    const extractedDir = extractArchive(downloaded.filePath);
    const workingDir = findThemeManifestRoot(extractedDir);

    const manifestPath = path.join(workingDir, "theme.json");
    const manifestRaw = fs.readFileSync(manifestPath);
    if (manifestRaw.byteLength > MAX_THEME_JSON_BYTES) {
      throw new Error("theme.json 過大（超過 32KB），拒絕安裝");
    }
    let manifestJson: unknown;
    try {
      manifestJson = JSON.parse(manifestRaw.toString("utf-8").replace(/^﻿/, ""));
    } catch {
      throw new Error("theme.json 無法解析為 JSON");
    }
    const manifest = validateThemeManifest(manifestJson, themeId);

    if (expectedVersion && manifest.version !== expectedVersion) {
      throw new Error(
        `主題版本不一致（索引為 ${expectedVersion}、套件為 ${manifest.version}）——拒絕安裝`
      );
    }

    const hostVersion = readHostVersion();
    if (!versionAtLeast(hostVersion, manifest.minHostVersion)) {
      throw new Error(
        `主程式版本 ${hostVersion} 低於主題最低需求 ${manifest.minHostVersion}——拒絕安裝`
      );
    }

    const cssPath = path.join(workingDir, manifest.cssFile);
    if (!fs.existsSync(cssPath)) {
      throw new Error(`主題包缺少樣式檔 ${manifest.cssFile}`);
    }
    const cssRaw = fs.readFileSync(cssPath);
    if (cssRaw.byteLength > MAX_CSS_BYTES) {
      throw new Error("styles.css 過大（超過 64KB），拒絕安裝");
    }
    const parsedColors = parseThemeCssVariables(cssRaw.toString("utf-8"), manifest.themeId);

    // 以預設主題補底成完整 33 鍵（ThemeContext 逐鍵注入，未覆寫者沿用預設）
    const colors = {
      ...defaultTheme.colors,
      ...parsedColors,
    } as ThemeColors;

    await logActivity({
      userId: session.uid,
      role: "admin",
      action: "theme_market_installed",
      ip: getClientIp(request),
      details: `主題市集安裝「${manifest.themeId}」v${manifest.version}`,
    });

    return NextResponse.json({
      success: true,
      message: `主題「${manifest.name}」v${manifest.version} 安裝完成，可在右上角主題選單中啟用`,
      package: {
        theme: manifest,
        themeId: manifest.themeId,
        colors,
        preview: colors["--bg"],
        checksumSha256: downloaded.sha256,
        installedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Theme market install error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "主題安裝失敗",
      },
      { status: 500 }
    );
  }
}
