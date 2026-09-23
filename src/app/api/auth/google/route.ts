import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { createSession } from "@/lib/server-session";
import { logActivity, getClientIp } from "@/lib/audit";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";
import { serverErrorMessage } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const limited = enforceRateLimit(request, "google", RATE.GOOGLE.limit, RATE.GOOGLE.windowMs);
    if (limited) return limited;

    const { idToken, role } = await request.json();
    const ip = getClientIp(request);

    if (!idToken || !isUserRole(role)) {
      return NextResponse.json({ success: false, message: "參數錯誤" }, { status: 400 });
    }

    // 本機驗證 Firebase ID token（signInWithPopup 產生），不打 identitytoolkit
    let email: string | undefined;
    try {
      const decoded = await getAdminAuth().verifyIdToken(String(idToken));
      email = decoded.email?.toLowerCase().trim();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("verifyIdToken failed:", msg);
      return NextResponse.json(
        { success: false, message: `Google token 驗證失敗：${msg.slice(0, 300)}` },
        { status: 401 }
      );
    }

    if (!email) {
      return NextResponse.json({ success: false, message: "無法取得 Google 帳號資訊" }, { status: 401 });
    }

    const collectionName = ROLE_COLLECTIONS[role];
    const snapshot = await getAdminDb()
      .collection(collectionName)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      await logActivity({
        action: "login_failed",
        role,
        ip,
        details: `Google 帳號未註冊於所選身分：${email}`,
      });
      return NextResponse.json({
        success: false,
        message: `此 Google 帳號尚未註冊於所選身分`,
      });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.lockedUntil && Date.now() < userData.lockedUntil) {
      const remainMin = Math.ceil((userData.lockedUntil - Date.now()) / 60000);
      return NextResponse.json({
        success: false,
        message: `帳號已鎖定，請 ${remainMin} 分鐘後再試`,
      });
    }

    const now = Date.now();
    const loginRecords =
      role === "admin"
        ? undefined
        : [...((userData.loginRecords as number[]) || []), now].slice(-50);

    await userDoc.ref.update({
      failedAttempts: 0,
      lockedUntil: 0,
      lastLogin: now,
      lastLoginMethod: "google",
      loginCount: (userData.loginCount || 0) + 1,
      ...(loginRecords ? { loginRecords } : {}),
    });

    const user = {
      uid: userDoc.id,
      email: userData.email,
      account: userData.account,
      displayName: userData.name || userData.displayName || "",
      role,
      tokenVersion: typeof userData.tokenVersion === "number" ? userData.tokenVersion : 1,
    };

    await createSession(user);

    await logActivity({
      userId: userDoc.id,
      role,
      action: "login",
      ip,
      details: "Google 登入成功",
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Google session error:", error);
    return NextResponse.json(
      { success: false, message: serverErrorMessage(error, "系統錯誤，請稍後再試") },
      { status: 500 }
    );
  }
}
