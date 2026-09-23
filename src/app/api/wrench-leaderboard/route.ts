import { NextRequest, NextResponse } from "next/server";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifySession } from "@/lib/dal";
import { unauthorized } from "@/lib/server-session";
import { ROLE_LABELS, UserRole } from "@/types/users";

const COLLECTION = "wrenchLeaderboard";
const TOP_N = 100;

export interface LeaderboardEntry {
  uid: string;
  name: string;
  role: UserRole;
  score: number;
  updatedAt: number;
}

function displayNameOf(session: { account: string; displayName?: string }): string {
  return session.displayName || session.account || "玩家";
}

export async function GET() {
  try {
    const topSnap = await getDocs(
      query(collection(db, COLLECTION), orderBy("score", "desc"), limit(TOP_N))
    );

    const top = topSnap.docs.map((d, index) => {
      const data = d.data() as LeaderboardEntry;
      return {
        rank: index + 1,
        name: data.name,
        role: data.role,
        roleLabel: ROLE_LABELS[data.role] ?? data.role,
        score: Number(data.score) || 0,
        uid: data.uid,
      };
    });

    const session = await verifySession();
    let my: {
      name: string;
      role: UserRole;
      roleLabel: string;
      score: number;
      rank: number | null;
    } | null = null;

    if (session) {
      const mineSnap = await getDocs(
        query(collection(db, COLLECTION), where("uid", "==", session.uid), limit(1))
      );
      if (!mineSnap.empty) {
        const data = mineSnap.docs[0].data() as LeaderboardEntry;
        const rankIndex = top.findIndex((e) => e.uid === session.uid);
        my = {
          name: data.name,
          role: data.role,
          roleLabel: ROLE_LABELS[data.role] ?? data.role,
          score: Number(data.score) || 0,
          rank: rankIndex >= 0 ? rankIndex + 1 : null,
        };
      }
    }

    return NextResponse.json({ success: true, top, my });
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
  const newScore = Math.floor(raw);

  try {
    const col = collection(db, COLLECTION);
    const name = displayNameOf(session);

    const mineSnap = await getDocs(query(col, where("uid", "==", session.uid), limit(1)));
    const mineDoc = mineSnap.docs[0] ?? null;
    const currentScore = mineDoc ? Number(mineDoc.data().score) || 0 : 0;

    if (mineDoc && newScore <= currentScore) {
      return NextResponse.json({
        success: true,
        score: currentScore,
        improved: false,
      });
    }

    const topSnap = await getDocs(query(col, orderBy("score", "desc"), limit(TOP_N)));
    const cutoff =
      topSnap.size >= TOP_N ? Number(topSnap.docs[TOP_N - 1].data().score) || 0 : 0;

    if (!mineDoc && topSnap.size >= TOP_N && newScore <= cutoff) {
      return NextResponse.json({
        success: true,
        score: newScore,
        improved: false,
        ranked: false,
      });
    }

    const payload = {
      uid: session.uid,
      name,
      role: session.role,
      score: newScore,
      updatedAt: Date.now(),
    };

    if (mineDoc) {
      await updateDoc(doc(db, COLLECTION, mineDoc.id), payload);
    } else {
      await addDoc(col, payload);
    }

    const allSnap = await getDocs(query(col, orderBy("score", "desc")));
    if (allSnap.size > TOP_N) {
      const excess = allSnap.docs.slice(TOP_N);
      await Promise.all(excess.map((d) => deleteDoc(doc(db, COLLECTION, d.id))));
    }

    const refreshed = await getDocs(query(col, orderBy("score", "desc"), limit(TOP_N)));
    const rank = refreshed.docs.findIndex((d) => d.data().uid === session.uid);

    return NextResponse.json({
      success: true,
      score: newScore,
      improved: true,
      ranked: rank >= 0,
      rank: rank >= 0 ? rank + 1 : null,
    });
  } catch {
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" }, { status: 500 });
  }
}
