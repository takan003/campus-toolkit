import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "未登入" }, { status: 401 });
  }
  return NextResponse.json({ success: true, user: session });
}
