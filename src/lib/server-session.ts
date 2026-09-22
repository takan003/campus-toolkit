import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { UserRole } from "@/types/users";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SessionPayload,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-token";
import { revokeJti } from "@/lib/revocation";

export { SESSION_COOKIE };
export type { SessionPayload };

export async function createSession(
  payload: Omit<SessionPayload, "jti"> & { jti?: string }
): Promise<SessionPayload> {
  const session: SessionPayload = {
    ...payload,
    jti: payload.jti || crypto.randomUUID(),
  };
  const token = await signSessionToken(session);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return session;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await verifySessionToken(token);
    if (session?.jti) {
      try {
        await revokeJti(session.jti);
      } catch (error) {
        console.error("Revoke jti error:", error);
      }
    }
  }
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
