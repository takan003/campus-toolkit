import { NextResponse } from "next/server";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashPassword } from "@/lib/auth";
import { verifySession } from "@/lib/dal";
import { unauthorized, forbidden } from "@/lib/server-session";
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

export async function seedRoles() {
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
      cleaned: await removeWrenchFieldFromUsers(),
      message: `建立 ${created.length} 筆，略過 ${skipped.length} 筆`,
    });
  } catch (error) {
    console.error("Seed roles error:", error);
    return NextResponse.json({ success: false, message: "系統錯誤，請稍後再試" });
  }
}

async function removeWrenchFieldFromUsers(): Promise<number> {
  let cleaned = 0;
  for (const col of Object.values(ROLE_COLLECTIONS)) {
    const snap = await getDocs(collection(db, col));
    for (const d of snap.docs) {
      if ("丟板手" in d.data()) {
        await updateDoc(d.ref, { 丟板手: deleteField() });
        cleaned += 1;
      }
    }
  }
  return cleaned;
}

export async function GET() {
  const session = await verifySession();
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();
  return seedRoles();
}

export async function POST() {
  const session = await verifySession();
  if (!session) return unauthorized();
  if (session.role !== "admin") return forbidden();
  return seedRoles();
}
