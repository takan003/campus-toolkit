import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashPassword } from "@/lib/auth";
import { getSession, unauthorized, forbidden } from "@/lib/server-session";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();
  return null;
}

export async function GET() {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const adminsRef = collection(db, "admins");
    const snapshot = await getDocs(adminsRef);

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
    return NextResponse.json({ success: false, message: "系統錯誤" });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { uid, email, account, displayName, password, costFactor } = await request.json();

    if (!uid) {
      return NextResponse.json({ success: false, message: "缺少管理員 ID" });
    }

    const adminRef = doc(db, "admins", uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      return NextResponse.json({ success: false, message: "管理員不存在" });
    }

    const updateData: Record<string, unknown> = {};
    if (email) updateData.email = email.toLowerCase().trim();
    if (account) updateData.account = account.toLowerCase().trim();
    if (displayName !== undefined) updateData.displayName = displayName;
    if (password) updateData.passwordHash = await hashPassword(password, costFactor || 12);

    await updateDoc(adminRef, updateData);

    return NextResponse.json({ success: true, message: "更新成功" });
  } catch (error) {
    console.error("Update admin error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤" });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;

    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ success: false, message: "缺少管理員 ID" });
    }

    await deleteDoc(doc(db, "admins", uid));

    return NextResponse.json({ success: true, message: "刪除成功" });
  } catch (error) {
    console.error("Delete admin error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤" });
  }
}
