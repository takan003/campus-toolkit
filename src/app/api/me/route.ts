import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySession } from "@/lib/dal";
import { unauthorized } from "@/lib/server-session";
import { ROLE_COLLECTIONS, ROLE_SPECIFIC_FIELDS, isUserRole } from "@/types/users";

export interface MeProfile {
  name: string;
  fields: Record<string, string>;
}

export async function GET() {
  const session = await verifySession();
  if (!session) return unauthorized();

  if (!isUserRole(session.role) || session.role === "admin") {
    return NextResponse.json({ success: true, profile: { name: session.displayName, fields: {} } });
  }

  try {
    const snap = await getAdminDb()
      .collection(ROLE_COLLECTIONS[session.role])
      .doc(session.uid)
      .get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: "找不到使用者資料" }, { status: 404 });
    }
    const data = snap.data() ?? {};
    const fields: Record<string, string> = {};
    for (const f of ROLE_SPECIFIC_FIELDS[session.role]) {
      fields[f.key] = String(data[f.key] ?? "");
    }
    const profile: MeProfile = {
      name: typeof data.name === "string" && data.name ? data.name : session.displayName,
      fields,
    };
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Profile load error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤" }, { status: 500 });
  }
}
