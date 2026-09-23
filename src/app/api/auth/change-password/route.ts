import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { verifySession } from "@/lib/dal";
import { createSession, getSession, unauthorized, forbidden } from "@/lib/server-session";
import { revokeJti } from "@/lib/revocation";
import { logActivity, getClientIp } from "@/lib/audit";
import { enforceRateLimit, RATE, checkRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";

export async function POST(request: NextRequest) {
  try {
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

    const collectionName = ROLE_COLLECTIONS[role];
    const usersRef = collection(db, collectionName);
    const input = account.toLowerCase().trim();
    const isEmail = input.includes("@");

    const q = isEmail
      ? query(usersRef, where("email", "==", input))
      : query(usersRef, where("account", "==", input));

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return NextResponse.json({ success: false, message: "帳號不存在" });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

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
    await updateDoc(doc(db, collectionName, userDoc.id), {
      passwordHash,
      tokenVersion: newTokenVersion,
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
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}
