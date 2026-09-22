import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifyPassword } from "@/lib/auth";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { account, password, role } = await request.json();

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
      return NextResponse.json({ success: false, message: "帳號或密碼錯誤" });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.lockedUntil && Date.now() < userData.lockedUntil) {
      const remainMin = Math.ceil((userData.lockedUntil - Date.now()) / 60000);
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

      if (newFailCount >= LOCK_THRESHOLD) {
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

    return NextResponse.json({
      success: true,
      user: {
        uid: userDoc.id,
        email: userData.email,
        account: userData.account,
        displayName: userData.name || userData.displayName || "",
        role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}
