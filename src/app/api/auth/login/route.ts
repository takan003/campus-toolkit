import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifyPassword } from "@/lib/auth";
import { AdminUser } from "@/types/admin";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { account, password } = await request.json();

    if (!account || !password) {
      return NextResponse.json({ success: false, message: "請輸入帳號與密碼" });
    }

    const adminsRef = collection(db, "admins");
    const q = query(adminsRef, where("account", "==", account.toLowerCase().trim()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ success: false, message: "帳號或密碼錯誤" });
    }

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data() as AdminUser;

    if (adminData.lockedUntil && Date.now() < adminData.lockedUntil) {
      const remainMin = Math.ceil((adminData.lockedUntil - Date.now()) / 60000);
      return NextResponse.json({
        success: false,
        message: `帳號已鎖定，請 ${remainMin} 分鐘後再試`,
      });
    }

    const isValid = await verifyPassword(password, adminData.passwordHash);

    if (!isValid) {
      const newFailCount = (adminData.failedAttempts || 0) + 1;
      const lockUntil = newFailCount >= LOCK_THRESHOLD ? Date.now() + LOCK_DURATION_MS : 0;

      await updateDoc(doc(db, "admins", adminDoc.id), {
        failedAttempts: newFailCount,
        lockedUntil: lockUntil,
      });

      if (newFailCount >= LOCK_THRESHOLD) {
        return NextResponse.json({
          success: false,
          message: "帳號已鎖定，請 15 分鐘後再試",
        });
      }

      return NextResponse.json({ success: false, message: "帳號或密碼錯誤" });
    }

    await updateDoc(doc(db, "admins", adminDoc.id), {
      failedAttempts: 0,
      lockedUntil: 0,
      lastLogin: Date.now(),
      lastLoginMethod: "password",
      loginCount: (adminData.loginCount || 0) + 1,
    });

    return NextResponse.json({
      success: true,
      user: {
        uid: adminDoc.id,
        email: adminData.email,
        account: adminData.account,
        displayName: adminData.displayName,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}
