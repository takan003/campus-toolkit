import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
  }
  const { jti: _jti, ...user } = session;
  return NextResponse.json({ success: true, user });
}
