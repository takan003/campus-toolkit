import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SESSION_ABSOLUTE_MAX_AGE_SECONDS,
  SessionPayload,
  signSessionToken,
  verifySessionToken,
} from "@/lib/session-token";
import { revokeJti } from "@/lib/revocation";

export { SESSION_COOKIE };
export type { SessionPayload };

function sessionCookieOptions(absoluteExpiresAt?: number) {
  let maxAge = SESSION_MAX_AGE_SECONDS;
  if (typeof absoluteExpiresAt === "number" && absoluteExpiresAt > 0) {
    maxAge = Math.max(1, Math.floor((absoluteExpiresAt - Date.now()) / 1000));
  }
  return {
    httpOnly: true,
    // __Host- 前綴要求 Secure：production（HTTPS）一律設定；
    // 開發名稱無前綴，沿用原本仅 production 啟用的行為。
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createSession(
  payload: Omit<SessionPayload, "jti" | "lastActivityAt" | "absoluteExpiresAt"> & {
    jti?: string;
    lastActivityAt?: number;
    absoluteExpiresAt?: number;
  }
): Promise<SessionPayload> {
  const session: SessionPayload = {
    ...payload,
    jti: payload.jti || crypto.randomUUID(),
    lastActivityAt: payload.lastActivityAt || Date.now(),
    absoluteExpiresAt:
      payload.absoluteExpiresAt || Date.now() + SESSION_ABSOLUTE_MAX_AGE_SECONDS * 1000,
  };
  const token = await signSessionToken(session);

  const cookieStore = await cookies();
  // 清除改名前遺留的舊 cookie（僅 production 使用 __Host- 前綴）
  if (SESSION_COOKIE !== "session") cookieStore.delete("session");
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(session.absoluteExpiresAt));

  return session;
}

/** 使用者活動時滑動續期：重簽同 jti/tokenVersion 的 token，更新 lastActivityAt；absoluteExpiresAt 保留原值不重設 */
export async function refreshSessionActivity(session: SessionPayload): Promise<void> {
  const token = await signSessionToken({ ...session, lastActivityAt: Date.now() });
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(session.absoluteExpiresAt)
  );
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
  if (SESSION_COOKIE !== "session") cookieStore.delete("session");
}

export function unauthorized(message = "未登入或登入已失效"): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 401 });
}

export function forbidden(message = "權限不足"): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 403 });
}
