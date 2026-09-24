import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { refreshSessionActivity } from "@/lib/server-session";
import { assertSameOrigin } from "@/lib/csrf";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { serverErrorMessage } from "@/lib/api-error";

/**
 * 閒置續期（keepalive）：使用者有活動時由前端節流呼叫，
 * 驗證 session 有效（含伺服器端閒置逾時）後滑動更新 JWT lastActivityAt。
 * 回 401 代表伺服器已判定逾時／失效，前端應導回登入頁。
 */
export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const limited = enforceRateLimit(
      request,
      "session-keepalive",
      RATE.KEEPALIVE.limit,
      RATE.KEEPALIVE.windowMs
    );
    if (limited) return limited;

    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ success: false, message: "未登入或登入已失效" }, { status: 401 });
    }

    await refreshSessionActivity(session);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session keepalive error:", error);
    return NextResponse.json(
      { success: false, message: serverErrorMessage(error, "系統錯誤") },
      { status: 500 }
    );
  }
}
