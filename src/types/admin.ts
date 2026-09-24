export interface AdminUser {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  passwordHash: string;
  lastLogin: number;
  lastLoginMethod: string;
  loginCount: number;
  failedAttempts: number;
  lockedUntil: number;
  lockIp?: string;
  tokenVersion: number;
  createdAt: number;
}

export const defaultAdminUser: Omit<AdminUser, "uid" | "passwordHash" | "createdAt"> = {
  email: "",
  account: "",
  displayName: "",
  lastLogin: 0,
  lastLoginMethod: "",
  loginCount: 0,
  failedAttempts: 0,
  lockedUntil: 0,
  tokenVersion: 1,
};
