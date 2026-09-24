import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/server-session";
import { logActivity, getClientIp } from "@/lib/audit";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";
import { serverErrorMessage } from "@/lib/api-error";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "帳號或密碼錯誤";

// 帳號不存在時也跑一次同成本 bcrypt，消除「有無帳號」的時序差（帳號枚舉）
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("timing-equalization-placeholder", 12);
  }
  return dummyHashPromise;
}

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
    const usersRef = getAdminDb().collection(collectionName);

    const input = String(account).toLowerCase().trim();
    const isEmail = input.includes("@");

    const snapshot = await usersRef
      .where(isEmail ? "email" : "account", "==", input)
      .limit(1)
      .get();

    if (snapshot.empty) {
      await verifyPassword(password, await getDummyHash());
      await logActivity({
        action: "login_failed",
        role,
        ip,
        details: `帳號不存在或錯誤：${input}`,
      });
      return NextResponse.json({ success: false, message: GENERIC_LOGIN_ERROR });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // 鎖定綁定觸發時的來源 IP：其他 IP 不受鎖定影響，避免跨 IP 鎖號 DoS。
    // 未記錄 lockIp 的舊資料或無法取得來源 IP 時，維持全域鎖定（fail closed）。
    const lockedUntil = typeof userData.lockedUntil === "number" ? userData.lockedUntil : 0;
    const lockIp = typeof userData.lockIp === "string" ? userData.lockIp : "";
    const lockActive =
      lockedUntil > Date.now() && (!lockIp || !ip || lockIp === ip);

    if (lockActive) {
      await logActivity({
        userId: userDoc.id,
        role,
        action: "login_failed",
        ip,
        details: "帳號已鎖定期間嘗試登入",
      });
      // 回覆與一般失敗相同，不證實帳號是否存在、也不透露鎖定狀態
      return NextResponse.json({ success: false, message: GENERIC_LOGIN_ERROR });
    }

    const isValid = await verifyPassword(password, userData.passwordHash);

    if (!isValid) {
      const newFailCount = (userData.failedAttempts || 0) + 1;
      const lockUntil = newFailCount >= LOCK_THRESHOLD ? Date.now() + LOCK_DURATION_MS : 0;

      await userDoc.ref.update({
        failedAttempts: newFailCount,
        lockedUntil: lockUntil,
        ...(lockUntil ? { lockIp: ip } : {}),
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
          details: `連續失敗 ${LOCK_THRESHOLD} 次，鎖定 15 分鐘（限來源 ${ip || "未知"}）`,
        });
        return NextResponse.json({ success: false, message: GENERIC_LOGIN_ERROR });
      }

      return NextResponse.json({ success: false, message: GENERIC_LOGIN_ERROR });
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
    return NextResponse.json(
      {
        success: false,
        message: serverErrorMessage(error, "系統錯誤，請稍後再試"),
      },
      { status: 500 }
    );
  }
}
