import "server-only";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, SessionPayload } from "@/lib/server-session";
import { isJtiRevoked } from "@/lib/revocation";
import { ROLE_COLLECTIONS, UserRole } from "@/types/users";

export async function verifySession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.jti && (await isJtiRevoked(session.jti))) return null;

  try {
    const snap = await getAdminDb()
      .collection(ROLE_COLLECTIONS[session.role])
      .doc(session.uid)
      .get();
    if (!snap.exists) return null;

    const data = snap.data();
    const tokenVersion = typeof data?.tokenVersion === "number" ? data.tokenVersion : 1;
    if (session.tokenVersion !== tokenVersion) return null;

    if (data?.lockedUntil && Date.now() < data.lockedUntil) return null;

    return session;
  } catch {
    return null;
  }
}

export async function verifyRole(role: UserRole): Promise<SessionPayload | null> {
  const session = await verifySession();
  if (!session || session.role !== role) return null;
  return session;
}

export type AuthDenial =
  | { status: 401; message: string }
  | { status: 403; message: string };

export function toAuthResponse(denial: AuthDenial): NextResponse {
  return NextResponse.json(
    { success: false, message: denial.message },
    { status: denial.status }
  );
}

export async function requireRole(role: UserRole): Promise<
  { session: SessionPayload; denial: null } | { session: null; denial: AuthDenial }
> {
  const session = await verifySession();
  if (!session) {
    return { session: null, denial: { status: 401, message: "未登入或登入已失效" } };
  }
  if (session.role !== role) {
    return { session: null, denial: { status: 403, message: "權限不足" } };
  }
  return { session, denial: null };
}
