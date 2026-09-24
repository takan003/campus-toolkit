import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { UserRole, isUserRole } from "@/types/users";

// __Host- 前綴強制 Secure／Path=/／無 Domain，防止子域覆寫 session cookie（需 HTTPS）；
// 本機開發走 http（含 LAN IP）無法設定 Secure cookie，故維持原名稱。
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-session" : "session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface SessionPayload {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  role: UserRole;
  tokenVersion: number;
  jti: string;
  /** 最後一次使用者活動（epoch ms），用於伺服器端閒置逾時檢查 */
  lastActivityAt: number;
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
    lastActivityAt: payload.lastActivityAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setJti(payload.jti || crypto.randomUUID())
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

    if (
      typeof payload.iat === "number" &&
      Date.now() / 1000 - payload.iat > SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }

    const iatMs = typeof payload.iat === "number" ? payload.iat * 1000 : Date.now();

    return {
      uid: payload.uid,
      email: typeof payload.email === "string" ? payload.email : "",
      account: typeof payload.account === "string" ? payload.account : "",
      displayName: typeof payload.displayName === "string" ? payload.displayName : "",
      role: payload.role,
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 1,
      jti: typeof payload.jti === "string" ? payload.jti : "",
      lastActivityAt:
        typeof payload.lastActivityAt === "number" && payload.lastActivityAt > 0
          ? payload.lastActivityAt
          : iatMs,
    };
  } catch {
    return null;
  }
}
