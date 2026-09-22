import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { UserRole, isUserRole } from "@/types/users";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface SessionPayload {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  role: UserRole;
  tokenVersion: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 未設定或長度不足 32 字元");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    uid: payload.uid,
    email: payload.email,
    account: payload.account,
    displayName: payload.displayName,
    role: payload.role,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    if (!payload || !isUserRole(payload.role) || typeof payload.uid !== "string" || !payload.uid) {
      return null;
    }

    return {
      uid: payload.uid,
      email: typeof payload.email === "string" ? payload.email : "",
      account: typeof payload.account === "string" ? payload.account : "",
      displayName: typeof payload.displayName === "string" ? payload.displayName : "",
      role: payload.role,
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 1,
    };
  } catch {
    return null;
  }
}
