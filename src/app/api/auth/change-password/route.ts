import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { getSession, unauthorized, forbidden } from "@/lib/server-session";
import { ROLE_COLLECTIONS, isUserRole } from "@/types/users";

export async function POST(request: NextRequest) {
  try {
    const { account, oldPassword, newPassword, role } = await request.json();

    if (!account || !oldPassword || !newPassword) {
      return NextResponse.json({ success: false, message: "請填寫完整資訊" });
    }

    if (!isUserRole(role)) {
      return NextResponse.json({ success: false, message: "無效的角色" });
    }

    const session = await getSession();
    if (!session) return unauthorized();
    if (session.role !== role) return forbidden("身分不符");
    if (session.account !== account.toLowerCase().trim() && session.email !== account.toLowerCase().trim()) {
      return forbidden("僅能變更自身密碼");
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, message: "新密碼至少 8 碼" });
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
      return NextResponse.json({ success: false, message: "帳號不存在" });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    const isValid = await verifyPassword(oldPassword, userData.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, message: "目前密碼錯誤" });
    }

    const passwordHash = await hashPassword(newPassword, 12);
    await updateDoc(doc(db, collectionName, userDoc.id), {
      passwordHash,
      tokenVersion: (userData.tokenVersion || 1) + 1,
    });

    return NextResponse.json({ success: true, message: "密碼已更新" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}
