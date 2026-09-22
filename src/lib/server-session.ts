import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { UserRole, isUserRole } from "@/types/users";

export const SESSION_COOKIE = "session";
const ABSOLUTE_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface SessionPayload {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  role: UserRole;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 未設定或長度不足 32 字元");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({
    uid: payload.uid,
    email: payload.email,
    account: payload.account,
    displayName: payload.displayName,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ABSOLUTE_MAX_AGE_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

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
    };
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function unauthorized(message = "未登入或登入已失效"): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

export function forbidden(message = "權限不足"): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 403 });
}

export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}

export async function requireRole(role: UserRole): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || session.role !== role) return null;
  return session;
}
