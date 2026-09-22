import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/server-session";

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true, message: "已登出" });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤" }, { status: 500 });
  }
}
