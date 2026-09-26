import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { UserRole, TwoFactorMethod, isUserRole, isTwoFactorMethod } from "@/types/users";

// __Host- 前綴強制 Secure／Path=/／無 Domain，防止子域覆寫 session cookie（需 HTTPS）；
// 本機開發走 http（含 LAN IP）無法設定 Secure cookie，故維持原名稱。
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-session" : "session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
/** 絕對上限：無論 keepalive 如何續期，超過此時間必須重新登入（防被竊 cookie 無限續命） */
export const SESSION_ABSOLUTE_MAX_AGE_SECONDS = 12 * 60 * 60;

/** 兩階段驗證中途憑證 cookie：密碼驗證通過、第二階段尚未完成時使用 */
export const PENDING_2FA_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-pending2fa" : "pending2fa";
/** 第二階段驗證時限：逾時必須重新輸入帳密 */
export const PENDING_2FA_MAX_AGE_SECONDS = 10 * 60;

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
  /** 絕對過期時間（epoch ms），續期時保留原值、不重設 */
  absoluteExpiresAt: number;
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
    absoluteExpiresAt: payload.absoluteExpiresAt,
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

    // 有 purpose 的是其他用途的 token（如兩階段驗證中途憑證），不可當 session 使用
    if (typeof payload.purpose === "string" && payload.purpose) return null;

    if (
      typeof payload.iat === "number" &&
      Date.now() / 1000 - payload.iat > SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }

    const iatMs = typeof payload.iat === "number" ? payload.iat * 1000 : Date.now();

    // 絕對過期：續期只更新 lastActivityAt，不重設此值；
    // 舊 token 無此 claim 時以 iat + 絕對上限推導，保持同等約束。
    const absoluteExpiresAt =
      typeof payload.absoluteExpiresAt === "number" && payload.absoluteExpiresAt > 0
        ? payload.absoluteExpiresAt
        : iatMs + SESSION_ABSOLUTE_MAX_AGE_SECONDS * 1000;
    if (Date.now() >= absoluteExpiresAt) return null;

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
      absoluteExpiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * 兩階段驗證中途憑證：帳密已驗證通過、第二階段尚未完成。
 * 與 session 共用金鑰但帶 purpose claim，兩者不可互換（見 verifySessionToken）。
 */
export interface Pending2FAInput {
  uid: string;
  email: string;
  account: string;
  displayName: string;
  role: UserRole;
  /** 需要完成的第二階段方式 */
  method: Exclude<TwoFactorMethod, "off" | "email_notify">;
  /** 是從密碼登入還是 Google 登入進入第二階段（用來記 lastLoginMethod） */
  via: "password" | "google";
}

export interface Pending2FAPayload extends Pending2FAInput {
  /** 中途憑證過期時間（epoch ms） */
  expiresAt: number;
}

export async function signPending2FAToken(payload: Pending2FAInput): Promise<string> {
  return new SignJWT({
    purpose: "2fa",
    uid: payload.uid,
    email: payload.email,
    account: payload.account,
    displayName: payload.displayName,
    role: payload.role,
    method: payload.method,
    via: payload.via,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_2FA_MAX_AGE_SECONDS}s`)
    .setJti(crypto.randomUUID())
    .sign(getSecretKey());
}

export async function verifyPending2FAToken(token: string): Promise<Pending2FAPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload || payload.purpose !== "2fa") return null;
    if (!isUserRole(payload.role) || typeof payload.uid !== "string" || !payload.uid) return null;
    if (payload.method !== "email_otp" && payload.method !== "totp") return null;
    // exp 已由 jose 驗證；再以 iat 對照上限，防止時鐘偏移放行過舊 token
    if (
      typeof payload.iat === "number" &&
      Date.now() / 1000 - payload.iat > PENDING_2FA_MAX_AGE_SECONDS
    ) {
      return null;
    }

    return {
      uid: payload.uid,
      email: typeof payload.email === "string" ? payload.email : "",
      account: typeof payload.account === "string" ? payload.account : "",
      displayName: typeof payload.displayName === "string" ? payload.displayName : "",
      role: payload.role,
      method: payload.method,
      via: payload.via === "google" ? "google" : "password",
      expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : 0,
    };
  } catch {
    return null;
  }
}
