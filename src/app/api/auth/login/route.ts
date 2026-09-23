import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/server-session";
import { logActivity, getClientIp } from "@/lib/audit";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const limited = enforceRateLimit(request, "login", RATE.LOGIN.limit, RATE.LOGIN.windowMs);
    if (limited) return limited;

    const { account, password, role } = await request.json();
    const ip = getClientIp(request);

    if (!account || !password) {
      return NextResponse.json({ success: false, message: "請輸入帳號與密碼" });
    }

    if (!isUserRole(role)) {
      return NextResponse.json({ success: false, message: "請選擇身分" });
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
      await logActivity({
        action: "login_failed",
        role,
        ip,
        details: `帳號不存在或錯誤：${input}`,
      });
      return NextResponse.json({ success: false, message: "帳號或密碼錯誤" });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.lockedUntil && Date.now() < userData.lockedUntil) {
      const remainMin = Math.ceil((userData.lockedUntil - Date.now()) / 60000);
      await logActivity({
        userId: userDoc.id,
        role,
        action: "login_failed",
        ip,
        details: "帳號已鎖定期間嘗試登入",
      });
      return NextResponse.json({
        success: false,
        message: `帳號已鎖定，請 ${remainMin} 分鐘後再試`,
      });
    }

    const isValid = await verifyPassword(password, userData.passwordHash);

    if (!isValid) {
      const newFailCount = (userData.failedAttempts || 0) + 1;
      const lockUntil = newFailCount >= LOCK_THRESHOLD ? Date.now() + LOCK_DURATION_MS : 0;

      await updateDoc(doc(db, collectionName, userDoc.id), {
        failedAttempts: newFailCount,
        lockedUntil: lockUntil,
      });

      await logActivity({
        userId: userDoc.id,
        role,
        action: "login_failed",
        ip,
        details: `密碼錯誤，失敗次數 ${newFailCount}`,
      });

      if (newFailCount >= LOCK_THRESHOLD) {
        await logActivity({
          userId: userDoc.id,
          role,
          action: "account_locked",
          ip,
          details: "連續失敗 5 次，鎖定 15 分鐘",
        });
        return NextResponse.json({
          success: false,
          message: "帳號已鎖定，請 15 分鐘後再試",
        });
      }

      return NextResponse.json({ success: false, message: "帳號或密碼錯誤" });
    }

    const now = Date.now();
    const loginRecords =
      role === "admin"
        ? undefined
        : [...((userData.loginRecords as number[]) || []), now].slice(-50);

    await updateDoc(doc(db, collectionName, userDoc.id), {
      failedAttempts: 0,
      lockedUntil: 0,
      lastLogin: now,
      lastLoginMethod: "password",
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
      details: "帳密登入成功",
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}
