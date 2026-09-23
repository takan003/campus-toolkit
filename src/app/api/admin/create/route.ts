import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { hashPassword } from "@/lib/auth";
import { requireRole, toAuthResponse } from "@/lib/dal";
import { logActivity, getClientIp } from "@/lib/audit";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/csrf";
import { clampCostFactor, normalizeEmail, normalizeAccount, isStrongPassword } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const limited = enforceRateLimit(
      request,
      "admin-create",
      RATE.ADMIN_CREATE.limit,
      RATE.ADMIN_CREATE.windowMs
    );
    if (limited) return limited;

    const ip = getClientIp(request);
    const adminsRef = getAdminDb().collection("admins");
    const existingCount = (await adminsRef.count().get()).data().count;
    const isBootstrap = existingCount === 0;

    // Bootstrap（首任管理員）需顯式開啟，避免資料被清空後免驗證建管
    if (isBootstrap && process.env.ALLOW_BOOTSTRAP_ADMIN !== "true") {
      return NextResponse.json(
        { success: false, message: "初始管理員建立已停用（ALLOW_BOOTSTRAP_ADMIN 未啟用）" },
        { status: 403 }
      );
    }

    let session = null;
    if (!isBootstrap) {
      const { session: s, denial } = await requireRole("admin");
      if (denial) return toAuthResponse(denial);
      session = s;
    }

    const { email, account, password, displayName, costFactor } = await request.json();

    const normEmail = normalizeEmail(email);
    const normAccount = normalizeAccount(account);
    if (!normEmail || !normAccount || !password) {
      return NextResponse.json({ success: false, message: "請填寫完整資訊" });
    }
    if (!isStrongPassword(password)) {
      return NextResponse.json({ success: false, message: "密碼至少 8 碼" });
    }

    const emailSnapshot = await adminsRef.where("email", "==", normEmail).limit(1).get();
    if (!emailSnapshot.empty) {
      return NextResponse.json({ success: false, message: "此電子郵件已被使用" });
    }

    const accountSnapshot = await adminsRef.where("account", "==", normAccount).limit(1).get();
    if (!accountSnapshot.empty) {
      return NextResponse.json({ success: false, message: "此帳號已被使用" });
    }

    const passwordHash = await hashPassword(password, clampCostFactor(costFactor, 12));

    const newAdmin = {
      email: normEmail,
      account: normAccount,
      displayName: typeof displayName === "string" ? displayName.slice(0, 64) : "",
      passwordHash,
      twoFactorMethod: "none",
      totpSecret: "",
      lastLogin: 0,
      lastLoginMethod: "",
      loginCount: 0,
      failedAttempts: 0,
      lockedUntil: 0,
      tokenVersion: 1,
      createdAt: Date.now(),
    };

    const docRef = await adminsRef.add(newAdmin);

    await logActivity({
      userId: session?.uid,
      role: "admin",
      action: "admin_created",
      ip,
      details: isBootstrap
        ? `建立初始管理員 ${newAdmin.account}`
        : `由 ${session?.account || "管理員"} 建立 ${newAdmin.account}`,
    });

    return NextResponse.json({
      success: true,
      uid: docRef.id,
      message: "管理員建立成功",
    });
  } catch (error) {
    console.error("Create admin error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}
