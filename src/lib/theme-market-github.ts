/**
 * 市集 repo 的 GitHub 服務帳號橋樑（M2.5／§21）。
 *
 * 以環境變數 `THEME_MARKET_GITHUB_TOKEN`（僅需目標倉庫 contents ＋ pull requests 寫入）
 * 對市集 repo 開 PR——PR 即審核佇列，不設市集端資料庫與帳密。
 * 檔案內容依契約 §11.2：theme.json＋tokens.json＋styles.css（生成器產出，CI merge 後會再重建索引）。
 */

import { generateThemeCss, readHostVersion, validateColorTokens } from "@/lib/theme-market";

const GITHUB_API = "https://api.github.com";

export interface ThemeSubmissionInput {
  mode: "publish" | "submit";
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  colors: Record<string, string>;
  provenance: string;
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/** 解析服務帳號設定；未設定時回 null（路由回 503 指引） */
export function resolveMarketGithubConfig(): { token: string; repo: string } | null {
  const token = process.env.THEME_MARKET_GITHUB_TOKEN?.trim();
  const repo =
    process.env.THEME_MARKET_GITHUB_REPO?.trim() || "takan003/campus-toolkit-theme-marketplace";
  if (!token) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return { token, repo };
}

/** 驗證並整理投稿／發佈 payload（不符合契約 §11.1 時 throw，訊息可直回使用者） */
export function prepareThemeSubmission(
  body: Record<string, unknown>,
  options: { mode: "publish" | "submit"; defaultAuthor: string }
): ThemeSubmissionInput {
  const id = typeof body.id === "string" ? body.id.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const author = (typeof body.author === "string" && body.author.trim()) || options.defaultAuthor;
  const version = (typeof body.version === "string" && body.version.trim()) || "1.0.0";
  const rawTags = Array.isArray(body.tags) ? body.tags : [];

  if (!ID_PATTERN.test(id)) {
    throw new Error("id 需為 kebab-case（小寫字母、數字與連字號）");
  }
  if (name.length < 2 || name.length > 60) {
    throw new Error("名稱需為 2–60 字元");
  }
  if (description.length > 300) {
    throw new Error("說明最多 300 字元");
  }
  if (author.length > 80) {
    throw new Error("作者名稱最多 80 字元");
  }
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error("version 需為 semver（x.y.z）");
  }

  const tags = rawTags
    .filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
    .map((tag) => tag.trim().toLowerCase().slice(0, 24))
    .slice(0, 10);

  const colors = validateColorTokens(body.colors);

  return {
    mode: options.mode,
    id,
    name,
    description,
    author,
    version,
    tags,
    colors,
    provenance: options.defaultAuthor,
  };
}

async function githubRequest(
  token: string,
  apiPath: string,
  init: { method?: string; body?: unknown; allow404?: boolean } = {}
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${GITHUB_API}${apiPath}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (response.status === 404 && init.allow404) return null;
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`GitHub API 失敗（HTTP ${response.status}）：${detail}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function buildThemeJson(input: ThemeSubmissionInput): string {
  const manifest = {
    id: input.id,
    name: input.name,
    version: input.version,
    themeId: `market:${input.id}`,
    minHostVersion: readHostVersion(),
    author: input.author,
    description: input.description,
    preview: "preview.png",
    category: "theme",
    tags: input.tags,
    contractVersion: 1,
    cssFile: "styles.css",
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** 對市集 repo 開 PR（管理員發佈＝正式 PR；使用者投稿＝draft PR） */
export async function createThemePullRequest(
  input: ThemeSubmissionInput
): Promise<{ prUrl: string; branch: string }> {
  const config = resolveMarketGithubConfig();
  if (!config) {
    throw new Error(
      "尚未設定 THEME_MARKET_GITHUB_TOKEN（服務帳號 token）——發佈功能不可用，請聯絡管理者"
    );
  }
  const { token, repo } = config;
  const [owner, repoName] = repo.split("/");
  const repoBase = `/repos/${owner}/${repoName}`;

  const repoInfo = await githubRequest(token, repoBase);
  const baseBranch = typeof repoInfo?.default_branch === "string" ? repoInfo.default_branch : "main";

  const baseRef = await githubRequest(token, `${repoBase}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
  const baseSha = (baseRef?.object as { sha?: string } | undefined)?.sha;
  if (!baseSha) {
    throw new Error("無法取得市集 repo 基準分支位置");
  }

  // 目錄不得重名（契約 §11.1）
  const existing = await githubRequest(
    token,
    `${repoBase}/contents/themes/${encodeURIComponent(input.id)}?ref=${encodeURIComponent(baseBranch)}`,
    { allow404: true }
  );
  if (existing) {
    throw new Error(`市集中已存在 themes/${input.id}——請更換 id 或改走更新流程`);
  }

  const files: Record<string, string> = {
    [`themes/${input.id}/theme.json`]: buildThemeJson(input),
    [`themes/${input.id}/tokens.json`]: `${JSON.stringify(input.colors, null, 2)}\n`,
    [`themes/${input.id}/styles.css`]: generateThemeCss(`market:${input.id}`, input.colors),
  };

  const baseCommit = await githubRequest(token, `${repoBase}/git/commits/${baseSha}`);
  const baseTreeSha = (baseCommit?.tree as { sha?: string } | undefined)?.sha;
  if (!baseTreeSha) {
    throw new Error("無法取得市集 repo 基準 tree");
  }

  const treeEntries: Array<Record<string, unknown>> = [];
  for (const [filePath, content] of Object.entries(files)) {
    const blob = await githubRequest(token, `${repoBase}/git/blobs`, {
      method: "POST",
      body: { content, encoding: "utf-8" },
    });
    if (!blob?.sha) throw new Error(`建立 blob 失敗：${filePath}`);
    treeEntries.push({ path: filePath, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = await githubRequest(token, `${repoBase}/git/trees`, {
    method: "POST",
    body: { base_tree: baseTreeSha, tree: treeEntries },
  });
  if (!tree?.sha) throw new Error("建立 tree 失敗");

  const verb = input.mode === "publish" ? "publish" : "submit";
  const commit = await githubRequest(token, `${repoBase}/git/commits`, {
    method: "POST",
    body: {
      message: `${verb}: ${input.name} (${input.id}) v${input.version}`,
      tree: tree.sha,
      parents: [baseSha],
    },
  });
  if (!commit?.sha) throw new Error("建立 commit 失敗");

  const suffix = Date.now().toString(36);
  const branch = `${verb}/${input.id}-${suffix}`;
  await githubRequest(token, `${repoBase}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${branch}`, sha: commit.sha },
  });

  const prBody = [
    `## 主題${input.mode === "publish" ? "發佈" : "投稿"}`,
    "",
    `- **id**：\`${input.id}\`（themeId：\`market:${input.id}\`）`,
    `- **名稱**：${input.name}　**版本**：v${input.version}`,
    `- **作者**：${input.author}`,
    `- **說明**：${input.description || "（無）"}`,
    `- **標籤**：${input.tags.length ? input.tags.map((t) => "#" + t).join(" ") : "（無）"}`,
    "",
    "### Provenance（契約 §11.2）",
    `- 發起者：${input.provenance}`,
    `- 管道：${input.mode === "publish" ? "管理員發佈（M2.5）" : "使用者投稿（§21，draft）"}`,
    `- 時間：${new Date().toISOString()}`,
    "",
    "### CI 檢查",
    "merge 前請確認 validate-marketplace workflow 通過；merge 後 CI 會自動重建 index.json 與 releases。",
    "",
    "> 本 PR 由 campus-toolkit 服務帳號自動建立。",
  ].join("\n");

  const pr = await githubRequest(token, `${repoBase}/pulls`, {
    method: "POST",
    body: {
      title: `${verb}: ${input.name} (${input.id}) v${input.version}`,
      body: prBody,
      head: branch,
      base: baseBranch,
      draft: input.mode === "submit",
    },
  });
  const prUrl = typeof pr?.html_url === "string" ? pr.html_url : "";
  if (!prUrl) throw new Error("建立 PR 失敗");

  return { prUrl, branch };
}
