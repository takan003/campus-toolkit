import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashPassword } from "@/lib/auth";
import { requireRole, toAuthResponse } from "@/lib/dal";
import { logActivity, getClientIp } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const adminsRef = collection(db, "admins");
    const existing = await getDocs(adminsRef);
    const isBootstrap = existing.empty;

    let session = null;
    if (!isBootstrap) {
      const { session: s, denial } = await requireRole("admin");
      if (denial) return toAuthResponse(denial);
      session = s;
    }

    const { email, account, password, displayName, costFactor } = await request.json();

    if (!email || !account || !password) {
      return NextResponse.json({ success: false, message: "請填寫完整資訊" });
    }

    const emailCheck = query(adminsRef, where("email", "==", email.toLowerCase().trim()));
    const emailSnapshot = await getDocs(emailCheck);
    if (!emailSnapshot.empty) {
      return NextResponse.json({ success: false, message: "此電子郵件已被使用" });
    }

    const accountCheck = query(adminsRef, where("account", "==", account.toLowerCase().trim()));
    const accountSnapshot = await getDocs(accountCheck);
    if (!accountSnapshot.empty) {
      return NextResponse.json({ success: false, message: "此帳號已被使用" });
    }

    const passwordHash = await hashPassword(password, costFactor || 12);

    const newAdmin = {
      email: email.toLowerCase().trim(),
      account: account.toLowerCase().trim(),
      displayName: displayName || "",
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

    const docRef = await addDoc(adminsRef, newAdmin);

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
