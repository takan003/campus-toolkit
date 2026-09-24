import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/server-session";
import { logActivity, getClientIp } from "@/lib/audit";
import {
  enforceRateLimit,
  enforceAccountRateLimit,
  RATE,
} from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { isSystemEnabled } from "@/lib/settings-server";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";
import { serverErrorMessage } from "@/lib/api-error";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
/** 全域鎖定門檻：不綁 IP，跨來源累計失敗即鎖，擋 botnet／換 IP 爆破 */
const GLOBAL_LOCK_THRESHOLD = 20;
const GLOBAL_LOCK_DURATION_MS = 60 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "帳號或密碼錯誤";
const SYSTEM_DISABLED_MESSAGE = "系統目前暫停服務，請稍後再試";

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

    const limited = enforceRateLimit(
      request,
      "login",
      RATE.LOGIN.limit,
      RATE.LOGIN.windowMs
    );
    if (limited) return limited;

    let body: { account?: unknown; password?: unknown; role?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "請求內容無效" },
        { status: 400 }
      );
    }
    const { account, password, role } = body;
    const ip = getClientIp(request);

    if (
      typeof account !== "string" ||
      typeof password !== "string" ||
      !account ||
      !password
    ) {
      return NextResponse.json(
        { success: false, message: "請輸入帳號與密碼" },
        { status: 400 }
      );
    }

    if (!isUserRole(role)) {
      return NextResponse.json({ success: false, message: "請選擇身分" }, { status: 400 });
    }

    // 系統停用時僅允許管理員登入（以便重新啟用）
    if (role !== "admin" && !(await isSystemEnabled())) {
      return NextResponse.json(
        { success: false, message: SYSTEM_DISABLED_MESSAGE },
        { status: 503 }
      );
    }

    const input = String(account).toLowerCase().trim();

    // 帳號維度限流：不依賴 IP，擋針對單一帳號的爆破
    const accountLimited = enforceAccountRateLimit(
      "login",
      role,
      input,
      RATE.LOGIN_ACCOUNT.limit,
      RATE.LOGIN_ACCOUNT.windowMs
    );
    if (accountLimited) return accountLimited;

    const isEmail = input.includes("@");
    const collectionName = ROLE_COLLECTIONS[role];
    const usersRef = getAdminDb().collection(collectionName);

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
      // 401 + 通用訊息：不證實帳號是否存在（防枚舉）
      return NextResponse.json(
        { success: false, message: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    const lockedUntil = typeof userData.lockedUntil === "number" ? userData.lockedUntil : 0;
    const lockIp = typeof userData.lockIp === "string" ? userData.lockIp : "";
    const failedAttempts =
      typeof userData.failedAttempts === "number" ? userData.failedAttempts : 0;

    // 鎖定規則：
    // ① lockIp 為空字串 → 全域鎖定（fail closed），所有 IP 皆受限
    // ② lockIp 有值 → 僅綁定來源 IP（防跨 IP 鎖號 DoS）
    const lockActive =
      lockedUntil > Date.now() && (!lockIp || !ip || lockIp === ip);
    // 全域鎖定門檻：即使 lockIp 不符，失敗次數達標仍視為鎖定
    const globalLockActive =
      failedAttempts >= GLOBAL_LOCK_THRESHOLD && lockedUntil > Date.now();

    if (lockActive || globalLockActive) {
      await logActivity({
        userId: userDoc.id,
        role,
        action: "login_failed",
        ip,
        details: "帳號已鎖定期間嘗試登入",
      });
      // 回覆與一般失敗相同，不證實帳號是否存在、也不透露鎖定狀態
      return NextResponse.json(
        { success: false, message: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    // 鎖定已過期：重設計數，讓使用者在冷卻後重新開始
    const lockExpired = lockedUntil > 0 && lockedUntil <= Date.now();
    const baseFailures = lockExpired ? 0 : failedAttempts;

    const isValid = await verifyPassword(
      password,
      typeof userData.passwordHash === "string" ? userData.passwordHash : ""
    );

    if (!isValid) {
      const newFailCount = baseFailures + 1;
      let lockUntil = 0;
      let nextLockIp = ip;

      if (newFailCount >= GLOBAL_LOCK_THRESHOLD) {
        lockUntil = Date.now() + GLOBAL_LOCK_DURATION_MS;
        nextLockIp = ""; // 全域鎖定：清空 lockIp，對所有來源生效
      } else if (newFailCount >= LOCK_THRESHOLD) {
        const existingLockActive = lockedUntil > Date.now();
        if (!existingLockActive || !lockIp || lockIp === ip) {
          lockUntil = Date.now() + LOCK_DURATION_MS;
          nextLockIp = ip;
        } else {
          // 鎖定綁在其他 IP：保留原鎖定，僅累加計數，避免換 IP 釋放原鎖
          lockUntil = lockedUntil;
          nextLockIp = lockIp;
        }
      } else if (lockExpired) {
        lockUntil = 0;
        nextLockIp = "";
      }

      await userDoc.ref.update({
        failedAttempts: newFailCount,
        lockedUntil: lockUntil,
        lockIp: lockUntil ? nextLockIp : "",
      });

      await logActivity({
        userId: userDoc.id,
        role,
        action: "login_failed",
        ip,
        details: `密碼錯誤，失敗次數 ${newFailCount}`,
      });

      if (newFailCount >= GLOBAL_LOCK_THRESHOLD) {
        await logActivity({
          userId: userDoc.id,
          role,
          action: "account_locked",
          ip,
          details: `連續失敗 ${GLOBAL_LOCK_THRESHOLD} 次，全域鎖定 ${GLOBAL_LOCK_DURATION_MS / 60_000} 分鐘`,
        });
      } else if (newFailCount >= LOCK_THRESHOLD) {
        await logActivity({
          userId: userDoc.id,
          role,
          action: "account_locked",
          ip,
          details: `連續失敗 ${LOCK_THRESHOLD} 次，鎖定 15 分鐘（限來源 ${ip || "未知"}）`,
        });
      }

      return NextResponse.json(
        { success: false, message: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
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
