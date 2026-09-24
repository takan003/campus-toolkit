import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { createSession } from "@/lib/server-session";
import { logActivity, getClientIp } from "@/lib/audit";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { isSystemEnabled } from "@/lib/settings-server";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";
import { serverErrorMessage } from "@/lib/api-error";

const GENERIC_LOGIN_ERROR = "登入失敗，請稍後再試";

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

    // 系統停用時僅允許管理員登入（以便重新啟用）
    if (role !== "admin" && !(await isSystemEnabled())) {
      return NextResponse.json(
        { success: false, message: "系統目前暫停服務，請稍後再試" },
        { status: 503 }
      );
    }

    // 本機驗證 Firebase ID token（signInWithPopup 產生），不打 identitytoolkit
    let email: string | undefined;
    try {
      const decoded = await getAdminAuth().verifyIdToken(String(idToken));
      if (decoded.email_verified !== true) {
        return NextResponse.json(
          { success: false, message: "Google 電子郵件未經驗證" },
          { status: 401 }
        );
      }
      if (decoded.firebase?.sign_in_provider !== "google.com") {
        return NextResponse.json(
          { success: false, message: "僅支援 Google 帳號登入" },
          { status: 401 }
        );
      }
      email = decoded.email?.toLowerCase().trim();
    } catch (error) {
      console.error("verifyIdToken failed:", error);
      return NextResponse.json(
        { success: false, message: "Google 登入驗證失敗" },
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
      // 通用訊息：與密碼登入一致，避免帳號枚舉
      return NextResponse.json({
        success: false,
        message: GENERIC_LOGIN_ERROR,
      }, { status: 401 });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // 鎖定：全域（lockIp 為空）或綁定來源 IP（與密碼登入一致）
    const lockedUntil = typeof userData.lockedUntil === "number" ? userData.lockedUntil : 0;
    const lockIp = typeof userData.lockIp === "string" ? userData.lockIp : "";
    const failedAttempts =
      typeof userData.failedAttempts === "number" ? userData.failedAttempts : 0;
    const lockActive =
      lockedUntil > Date.now() && (!lockIp || !ip || lockIp === ip);
    const globalLockActive =
      failedAttempts >= 20 && lockedUntil > Date.now();
    if (lockActive || globalLockActive) {
      return NextResponse.json({
        success: false,
        message: GENERIC_LOGIN_ERROR,
      }, { status: 401 });
    }

    const now = Date.now();
    const loginRecords =
      role === "admin"
        ? undefined
        : [...((userData.loginRecords as number[]) || []), now].slice(-50);

    await userDoc.ref.update({
      failedAttempts: 0,
      lockedUntil: 0,
      lockIp: "",
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
