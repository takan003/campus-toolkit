import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { hashPassword } from "@/lib/auth";
import { requireRole, toAuthResponse } from "@/lib/dal";
import { assertSameOrigin } from "@/lib/csrf";
import { clampCostFactor, normalizeEmail, normalizeAccount, isStrongPassword } from "@/lib/validation";
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

    const denied = await requireAdmin();
    if (denied) return denied;

    const { uid, email, account, displayName, password, costFactor } = await request.json();

    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ success: false, message: "缺少管理員 ID" });
    }

    const adminRef = getAdminDb().collection("admins").doc(uid);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists) {
      return NextResponse.json({ success: false, message: "管理員不存在" });
    }

    const updateData: Record<string, unknown> = {};
    if (email !== undefined) {
      const normEmail = normalizeEmail(email);
      if (!normEmail) return NextResponse.json({ success: false, message: "電子郵件格式無效" });
      updateData.email = normEmail;
    }
    if (account !== undefined) {
      const normAccount = normalizeAccount(account);
      if (!normAccount) return NextResponse.json({ success: false, message: "帳號格式無效" });
      updateData.account = normAccount;
    }
    if (displayName !== undefined) {
      updateData.displayName = typeof displayName === "string" ? displayName.slice(0, 64) : "";
    }
    if (password) {
      if (!isStrongPassword(password)) {
        return NextResponse.json({ success: false, message: "密碼至少 8 碼" });
      }
      updateData.passwordHash = await hashPassword(password, clampCostFactor(costFactor, 12));
    }

    await adminRef.update(updateData);

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

    const denied = await requireAdmin();
    if (denied) return denied;

    const { uid } = await request.json();

    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ success: false, message: "缺少管理員 ID" });
    }

    const snapshot = await getAdminDb().collection("admins").count().get();
    if (snapshot.data().count <= 1) {
      return NextResponse.json(
        { success: false, message: "無法刪除最後一位管理員" },
        { status: 400 }
      );
    }

    await getAdminDb().collection("admins").doc(uid).delete();

    return NextResponse.json({ success: true, message: "刪除成功" });
  } catch (error) {
    console.error("Delete admin error:", error);
    return NextResponse.json({ success: false, message: serverErrorMessage(error, "系統錯誤") });
  }
}
