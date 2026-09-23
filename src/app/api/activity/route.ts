import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { logActivity, getClientIp } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { serverErrorMessage } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json({ success: false, message: "權限不足" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}) as { details?: string });
    const details = typeof body.details === "string" ? body.details.slice(0, 500) : "";

    await logActivity({
      userId: session.uid,
      role: session.role,
      action: "settings_change",
      ip: getClientIp(request),
      details: details || "系統設定已更新",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Activity log error:", error);
    return NextResponse.json(
      { success: false, message: serverErrorMessage(error, "系統錯誤") },
      { status: 500 }
    );
  }
}
