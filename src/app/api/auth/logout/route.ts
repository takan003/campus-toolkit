import { NextRequest, NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/server-session";
import { logActivity, getClientIp } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { serverErrorMessage } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const session = await getSession();
    await deleteSession();
    if (session) {
      await logActivity({
        userId: session.uid,
        role: session.role,
        action: "logout",
        ip: getClientIp(request),
        details: "登出並撤銷目前 session",
      });
    }
    return NextResponse.json({ success: true, message: "已登出" });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, message: serverErrorMessage(error, "系統錯誤") },
      { status: 500 }
    );
  }
}
