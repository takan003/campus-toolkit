import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { verifySession } from "@/lib/dal";
import { createSession, getSession, unauthorized, forbidden } from "@/lib/server-session";
import { revokeJti } from "@/lib/revocation";
import { logActivity, getClientIp } from "@/lib/audit";
import { enforceRateLimit, RATE, checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";
import { serverErrorMessage } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const ip = getClientIp(request);
    const limited = enforceRateLimit(
      request,
      "change-password",
      RATE.CHANGE_PASSWORD.limit,
      RATE.CHANGE_PASSWORD.windowMs
    );
    if (limited) return limited;

    const { account, oldPassword, newPassword, role } = await request.json();

    if (!account || !oldPassword || !newPassword) {
      return NextResponse.json({ success: false, message: "請填寫完整資訊" });
    }

    if (!isUserRole(role)) {
      return NextResponse.json({ success: false, message: "無效的角色" });
    }

    const session = await verifySession();
    if (!session) return unauthorized();
    if (session.role !== role) return forbidden("身分不符");
    if (session.account !== account.toLowerCase().trim() && session.email !== account.toLowerCase().trim()) {
      return forbidden("僅能變更自身密碼");
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, message: "新密碼至少 8 碼" });
    }

    // 一律以 session.uid 直取自身文件，避免用 body account 查詢命中他人文件（IDOR）
    const collectionName = ROLE_COLLECTIONS[session.role];
    const userDoc = await getAdminDb().collection(collectionName).doc(session.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, message: "帳號不存在" });
    }

    const userData = userDoc.data()!;

    const isValid = await verifyPassword(oldPassword, userData.passwordHash);
    if (!isValid) {
      // 舊密碼錯誤也計入失敗（enforceRateLimit 已先計成功次數，此處補記失敗軸）
      const failKey = `change-password-fail:${ip}`;
      const fail = checkRateLimit(failKey, 5, RATE.CHANGE_PASSWORD.windowMs);
      await logActivity({
        userId: session.uid,
        role,
        action: "login_failed",
        ip,
        details: "變更密碼時舊密碼錯誤",
      });
      if (!fail.ok) return tooManyRequests(fail.retryAfterSec);
      return NextResponse.json({ success: false, message: "目前密碼錯誤" });
    }

    const passwordHash = await hashPassword(newPassword, 12);
    const newTokenVersion = (userData.tokenVersion || 1) + 1;
    await userDoc.ref.update({
      passwordHash,
      tokenVersion: newTokenVersion,
      failedAttempts: 0,
      lockedUntil: 0,
      lockIp: "",
    });

    const priorSession = await getSession();
    if (priorSession?.jti) {
      await revokeJti(priorSession.jti);
    }

    await createSession({
      uid: session.uid,
      email: session.email,
      account: session.account,
      displayName: session.displayName,
      role: session.role,
      tokenVersion: newTokenVersion,
    });

    await logActivity({
      userId: session.uid,
      role,
      action: "password_changed",
      ip,
      details: "密碼已更新，舊 token 已撤銷",
    });

    return NextResponse.json({ success: true, message: "密碼已更新" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({
      success: false,
      message: serverErrorMessage(error, "系統錯誤，請稍後再試"),
    });
  }
}
