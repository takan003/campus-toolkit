import { NextResponse } from "next/server";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashPassword } from "@/lib/auth";
import {
  ROLE_COLLECTIONS,
  BaseUserRecord,
  StudentRecord,
  ParentRecord,
  StaffRecord,
} from "@/types/users";

const DEFAULT_EMAIL = "takan003@gms.hlgs.hlc.edu.tw";
const DEFAULT_ACCOUNT = "takan003";
const DEFAULT_PASSWORD = "111zzzZZZ";

async function existsIn(collectionName: string): Promise<boolean> {
  const byAccount = query(collection(db, collectionName), where("account", "==", DEFAULT_ACCOUNT));
  const byEmail = query(collection(db, collectionName), where("email", "==", DEFAULT_EMAIL));
  const [a, e] = await Promise.all([getDocs(byAccount), getDocs(byEmail)]);
  return !a.empty || !e.empty;
}

export async function POST() {
  try {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD, 12);
    const now = Date.now();

    const base: BaseUserRecord = {
      email: DEFAULT_EMAIL,
      account: DEFAULT_ACCOUNT,
      passwordHash,
      twoFactorEnabled: false,
      totpSecret: "",
      name: "",
      loginRecords: [],
      lastLoginMethod: "",
      loginCount: 0,
      cssThemeId: "",
      installedThemes: "[]",
      lockedUntil: 0,
      failedAttempts: 0,
      createdAt: now,
    };

    const created: string[] = [];
    const skipped: string[] = [];

    const studentCol = ROLE_COLLECTIONS.student;
    if (await existsIn(studentCol)) {
      skipped.push("student");
    } else {
      const student: StudentRecord = {
        ...base,
        name: "張同學",
        studentId: "910999",
        className: "101",
        classNumber: "10101",
      };
      await addDoc(collection(db, studentCol), student);
      created.push("student");
    }

    const parentCol = ROLE_COLLECTIONS.parent;
    if (await existsIn(parentCol)) {
      skipped.push("parent");
    } else {
      const parent: ParentRecord = {
        ...base,
        name: "張爸爸",
        studentName: "張同學",
        studentId: "910999",
        className: "101",
        classNumber: "10101",
      };
      await addDoc(collection(db, parentCol), parent);
      created.push("parent");
    }

    const staffCol = ROLE_COLLECTIONS.staff;
    if (await existsIn(staffCol)) {
      skipped.push("staff");
    } else {
      const staff: StaffRecord = {
        ...base,
        name: "張老師",
        className: "101",
        title: "導師",
        attribute: "教師",
      };
      await addDoc(collection(db, staffCol), staff);
      created.push("staff");
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      message: `建立 ${created.length} 筆，略過 ${skipped.length} 筆`,
    });
  } catch (error) {
    console.error("Seed roles error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}
