import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin, requireAdminModule, toAuthResponse } from "@/lib/dal";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { resolveThemeMarketIndexUrl } from "@/lib/theme-market";
import { parseThemeMarketIndex } from "@/types/theme-market";

export const dynamic = "force-dynamic";

const MAX_INDEX_BYTES = 512 * 1024;

/**
 * 主題市集索引讀取（Step 7，協議 §4.1）：
 * 比照模組市集 GET /api/admin/feature-modules/market——
 * 即時抓遠端 index.json、大小上限、JSON 解析、契約解析後回前端。
 */
export async function GET(request: NextRequest) {
  try {
    const limited = enforceRateLimit(
      request,
      "theme-market",
      RATE.THEME_MARKET_GET.limit,
      RATE.THEME_MARKET_GET.windowMs
    );
    if (limited) return limited;

    const { session, denial } = await requireAdminModule("themeMarket");
    if (denial) return toAuthResponse(denial);

    if (!(await isSuperAdmin(session))) {
      return NextResponse.json(
        { success: false, message: "僅超級管理員可查看主題市集" },
        { status: 403 }
      );
    }

    const marketUrl = resolveThemeMarketIndexUrl();
    if (!marketUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "尚未設定 THEME_MARKET_INDEX_URL，請先在 .env.local 或環境變數中填入市集 index.json URL",
        },
        { status: 503 }
      );
    }

    const response = await fetch(marketUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `市集來源回應失敗（HTTP ${response.status}）` },
        { status: 502 }
      );
    }

    const text = await response.text();
    const contentBytes = new TextEncoder().encode(text).length;
    if (contentBytes > MAX_INDEX_BYTES) {
      return NextResponse.json(
        { success: false, message: "市集資料過大，超過 512KB 限制" },
        { status: 413 }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, message: "市集 index.json 格式錯誤，無法解析 JSON" },
        { status: 400 }
      );
    }

    const index = parseThemeMarketIndex(payload);
    if (!index) {
      return NextResponse.json(
        { success: false, message: "市集 index.json 缺少有效的 modules 清單" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      marketUrl,
      generatedAt: index.generatedAt,
      marketplaceVersion: index.marketplaceVersion,
      themes: index.themes,
    });
  } catch (error) {
    console.error("Theme market fetch error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "讀取主題市集失敗",
    });
  }
}
