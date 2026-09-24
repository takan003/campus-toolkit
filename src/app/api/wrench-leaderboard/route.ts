import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySession } from "@/lib/dal";
import { unauthorized } from "@/lib/server-session";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { ROLE_LABELS, UserRole } from "@/types/users";
import { serverErrorMessage } from "@/lib/api-error";

const COLLECTION = "wrenchLeaderboard";
const TOP_N = 100;
const MAX_SCORE = 1_000_000;

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

function formatRecordDate(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export async function GET(request: NextRequest) {
  try {
    const limited = enforceRateLimit(
      request,
      "leaderboard-get",
      RATE.LEADERBOARD_GET.limit,
      RATE.LEADERBOARD_GET.windowMs
    );
    if (limited) return limited;

    const col = getAdminDb().collection(COLLECTION);
    const topSnap = await col.orderBy("score", "desc").limit(TOP_N).get();

    // 公開榜單不回傳 uid（僅伺服器端用來計算我的名次）
    const top = topSnap.docs.map((d, index) => {
      const data = d.data() as LeaderboardEntry;
      return {
        rank: index + 1,
        name: data.name,
        role: data.role,
        roleLabel: ROLE_LABELS[data.role] ?? data.role,
        score: Number(data.score) || 0,
        recordDate: formatRecordDate(Number(data.updatedAt) || 0),
      };
    });

    const session = await verifySession();
    let my: {
      name: string;
      role: UserRole;
      roleLabel: string;
      score: number;
      rank: number | null;
      recordDate: string;
    } | null = null;

    if (session) {
      const mineSnap = await col.where("uid", "==", session.uid).limit(1).get();
      if (!mineSnap.empty) {
        const data = mineSnap.docs[0].data() as LeaderboardEntry;
        const rankIndex = topSnap.docs.findIndex(
          (d) => (d.data() as LeaderboardEntry).uid === session.uid
        );
        my = {
          name: data.name,
          role: data.role,
          roleLabel: ROLE_LABELS[data.role] ?? data.role,
          score: Number(data.score) || 0,
          rank: rankIndex >= 0 ? rankIndex + 1 : null,
          recordDate: formatRecordDate(Number(data.updatedAt) || 0),
        };
      }
    }

    return NextResponse.json({ success: true, top, my });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: serverErrorMessage(error, "系統錯誤，請稍後再試") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const originDenied = assertSameOrigin(request);
  if (originDenied) return originDenied;

  const session = await verifySession();
  if (!session) return unauthorized();

  const limited = enforceRateLimit(
    request,
    "leaderboard-post",
    RATE.LEADERBOARD_POST.limit,
    RATE.LEADERBOARD_POST.windowMs,
    session.uid
  );
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const raw = body?.score;
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    raw < 0 ||
    raw > MAX_SCORE
  ) {
    return NextResponse.json({ success: false, message: "分數無效" }, { status: 400 });
  }
  const newScore = Math.floor(raw);

  try {
    const col = getAdminDb().collection(COLLECTION);
    const name = displayNameOf(session);

    const mineSnap = await col.where("uid", "==", session.uid).limit(1).get();
    const mineDoc = mineSnap.docs[0] ?? null;
    const currentScore = mineDoc ? Number(mineDoc.data().score) || 0 : 0;

    // 同一 uid 只保留一筆：破紀錄才更新，進不了前 100 則不寫入
    if (mineDoc && newScore <= currentScore) {
      return NextResponse.json({
        success: true,
        score: currentScore,
        improved: false,
        ranked: true,
      });
    }

    const topSnap = await col.orderBy("score", "desc").limit(TOP_N).get();
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
      await mineDoc.ref.update(payload);
    } else {
      await col.add(payload);
    }

    // 清理：用 offset 只取前 100 名之後的文件（不整表撈回全部欄位）
    const excessSnap = await col
      .orderBy("score", "desc")
      .offset(TOP_N)
      .select("score")
      .get();
    if (!excessSnap.empty) {
      await Promise.all(excessSnap.docs.map((d) => d.ref.delete()));
    }

    const refreshed = await col.orderBy("score", "desc").limit(TOP_N).get();
    const rank = refreshed.docs.findIndex((d) => d.data().uid === session.uid);

    return NextResponse.json({
      success: true,
      score: newScore,
      improved: true,
      ranked: rank >= 0,
      rank: rank >= 0 ? rank + 1 : null,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: serverErrorMessage(error, "系統錯誤，請稍後再試") },
      { status: 500 }
    );
  }
}
