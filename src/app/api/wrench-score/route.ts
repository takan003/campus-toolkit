import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifySession } from "@/lib/dal";
import { unauthorized } from "@/lib/server-session";
import { ROLE_COLLECTIONS } from "@/types/users";

const FIELD = "丟板手";

export async function GET() {
  const session = await verifySession();
  if (!session) return unauthorized();

  try {
    const snap = await getDoc(doc(db, ROLE_COLLECTIONS[session.role], session.uid));
    if (!snap.exists()) return unauthorized();
    const value = snap.data()[FIELD];
    const score = typeof value === "number" && value >= 0 ? value : 0;
    return NextResponse.json({ success: true, score });
  } catch {
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) return unauthorized();

  const body = await request.json().catch(() => null);
  const raw = body?.score;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return NextResponse.json({ success: false, message: "分數無效" }, { status: 400 });
  }

  try {
    const ref = doc(db, ROLE_COLLECTIONS[session.role], session.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return unauthorized();

    const current = snap.data()[FIELD];
    const currentScore = typeof current === "number" && current >= 0 ? current : 0;
    const nextScore = Math.max(currentScore, Math.floor(raw));

    if (nextScore !== currentScore) {
      await updateDoc(ref, { [FIELD]: nextScore });
    }

    return NextResponse.json({ success: true, score: nextScore });
  } catch {
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" }, { status: 500 });
  }
}
