export type UserRole = "student" | "parent" | "staff" | "admin";

export const ROLE_COLLECTIONS: Record<UserRole, string> = {
  student: "students",
  parent: "parents",
  staff: "staff",
  admin: "admins",
};

export const ROLE_HOME: Record<UserRole, string> = {
  student: "/student",
  parent: "/parent",
  staff: "/staff",
  admin: "/admin",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "學生",
  parent: "家長",
  staff: "教職員",
  admin: "管理員",
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "student" || value === "parent" || value === "staff" || value === "admin";
}

export interface BaseUserRecord {
  email: string;
  account: string;
  passwordHash: string;
  twoFactorEnabled: boolean;
  totpSecret: string;
  name: string;
  loginRecords: number[];
  lastLoginMethod: string;
  loginCount: number;
  cssThemeId: string;
  installedThemes: string;
  lockedUntil: number;
  failedAttempts: number;
  createdAt: number;
  /** 丟扳手小遊戲歷史最高分 */
  丟板手: number;
}

export interface StudentRecord extends BaseUserRecord {
  studentId: string;
  className: string;
  classNumber: string;
}

export interface ParentRecord extends BaseUserRecord {
  studentName: string;
  studentId: string;
  className: string;
  classNumber: string;
}

export interface StaffRecord extends BaseUserRecord {
  className: string;
  title: string;
  attribute: string;
}

export type RoleRecord = StudentRecord | ParentRecord | StaffRecord;

export const ROLE_SPECIFIC_FIELDS: Record<
  Exclude<UserRole, "admin">,
  { key: string; label: string }[]
> = {
  student: [
    { key: "studentId", label: "學號" },
    { key: "className", label: "班級" },
    { key: "classNumber", label: "班號" },
  ],
  parent: [
    { key: "studentName", label: "學生姓名" },
    { key: "studentId", label: "學號" },
    { key: "className", label: "班級" },
    { key: "classNumber", label: "班號" },
  ],
  staff: [
    { key: "className", label: "班級" },
    { key: "title", label: "職稱" },
    { key: "attribute", label: "屬性" },
  ],
};
