import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { hashPassword } from "@/lib/auth";
import { requireRole, toAuthResponse } from "@/lib/dal";
import { assertSameOrigin } from "@/lib/csrf";
import { enforceRateLimit, RATE } from "@/lib/rate-limit";
import { logActivity, getClientIp } from "@/lib/audit";
import { normalizeEmail, normalizeAccount, isStrongPassword } from "@/lib/validation";
import { serverErrorMessage } from "@/lib/api-error";

async function requireAdmin() {
  const { session, denial } = await requireRole("admin");
  if (denial) return toAuthResponse(denial);
  return null;
}

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const snapshot = await getAdminDb().collection("admins").get();

    const admins = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email,
        account: data.account,
        displayName: data.displayName,
        twoFactorMethod: data.twoFactorMethod,
        lastLogin: data.lastLogin,
        loginCount: data.loginCount,
        createdAt: data.createdAt,
      };
    });

    return NextResponse.json({ success: true, admins });
  } catch (error) {
    console.error("List admins error:", error);
    return NextResponse.json({ success: false, message: serverErrorMessage(error, "系統錯誤") });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const limited = enforceRateLimit(
      request,
      "admin-put",
      RATE.ADMIN_MUTATE.limit,
      RATE.ADMIN_MUTATE.windowMs
    );
    if (limited) return limited;

    const { session, denial } = await requireRole("admin");
    if (denial) return toAuthResponse(denial);

    const { uid, email, account, displayName, password } = await request.json();

    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ success: false, message: "缺少管理員 ID" });
    }

    const adminRef = getAdminDb().collection("admins").doc(uid);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists) {
      return NextResponse.json({ success: false, message: "管理員不存在" });
    }
    const target = adminSnap.data();

    const updateData: Record<string, unknown> = {};
    const adminsRef = getAdminDb().collection("admins");
    if (email !== undefined) {
      const normEmail = normalizeEmail(email);
      if (!normEmail) return NextResponse.json({ success: false, message: "電子郵件格式無效" });
      // 查重（排除自身），與 create 流程一致
      const dupEmail = await adminsRef.where("email", "==", normEmail).limit(1).get();
      if (!dupEmail.empty && dupEmail.docs[0].id !== uid) {
        return NextResponse.json({ success: false, message: "此電子郵件已被使用" });
      }
      updateData.email = normEmail;
    }
    if (account !== undefined) {
      const normAccount = normalizeAccount(account);
      if (!normAccount) return NextResponse.json({ success: false, message: "帳號格式無效" });
      // 查重（排除自身），與 create 流程一致
      const dupAccount = await adminsRef.where("account", "==", normAccount).limit(1).get();
      if (!dupAccount.empty && dupAccount.docs[0].id !== uid) {
        return NextResponse.json({ success: false, message: "此帳號已被使用" });
      }
      updateData.account = normAccount;
    }
    if (displayName !== undefined) {
      updateData.displayName = typeof displayName === "string" ? displayName.slice(0, 64) : "";
    }
    let passwordChanged = false;
    if (password) {
      if (!isStrongPassword(password)) {
        return NextResponse.json({ success: false, message: "密碼至少 8 碼" });
      }
      // costFactor 不接受 request body 指定：固定使用預設 12
      updateData.passwordHash = await hashPassword(password);
      // 重設他人密碼必須失效該帳號現有的所有 JWT
      const currentVersion =
        typeof target?.tokenVersion === "number" ? target.tokenVersion : 1;
      updateData.tokenVersion = currentVersion + 1;
      updateData.failedAttempts = 0;
      updateData.lockedUntil = 0;
      updateData.lockIp = "";
      passwordChanged = true;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: "無變更" });
    }

    await adminRef.update(updateData);

    await logActivity({
      userId: session.uid,
      role: "admin",
      action: "admin_updated",
      ip: getClientIp(request),
      details: `更新管理員 ${target?.account || uid}${passwordChanged ? "（密碼已重設，tokenVersion+1）" : ""}`,
    });

    return NextResponse.json({ success: true, message: "更新成功" });
  } catch (error) {
    console.error("Update admin error:", error);
    return NextResponse.json({ success: false, message: serverErrorMessage(error, "系統錯誤") });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const originDenied = assertSameOrigin(request);
    if (originDenied) return originDenied;

    const limited = enforceRateLimit(
      request,
      "admin-delete",
      RATE.ADMIN_MUTATE.limit,
      RATE.ADMIN_MUTATE.windowMs
    );
    if (limited) return limited;

    const { session, denial } = await requireRole("admin");
    if (denial) return toAuthResponse(denial);

    const { uid } = await request.json();

    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ success: false, message: "缺少管理員 ID" });
    }

    const adminRef = getAdminDb().collection("admins").doc(uid);
    const targetSnap = await adminRef.get();
    if (!targetSnap.exists) {
      return NextResponse.json({ success: false, message: "管理員不存在" });
    }
    const target = targetSnap.data();

    const snapshot = await getAdminDb().collection("admins").count().get();
    if (snapshot.data().count <= 1) {
      return NextResponse.json(
        { success: false, message: "無法刪除最後一位管理員" },
        { status: 400 }
      );
    }

    await adminRef.delete();

    await logActivity({
      userId: session.uid,
      role: "admin",
      action: "admin_deleted",
      ip: getClientIp(request),
      details: `刪除管理員 ${target?.account || uid}`,
    });

    return NextResponse.json({ success: true, message: "刪除成功" });
  } catch (error) {
    console.error("Delete admin error:", error);
    return NextResponse.json({ success: false, message: serverErrorMessage(error, "系統錯誤") });
  }
}
