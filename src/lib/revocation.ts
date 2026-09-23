import "server-only";
import { getAdminDb } from "@/lib/firebase-admin";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/session-token";

const REVOKED_COLLECTION = "revokedJTIs";

export async function revokeJti(jti: string): Promise<void> {
  if (!jti) return;
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  await getAdminDb().collection(REVOKED_COLLECTION).doc(jti).set({
    jti,
    revokedAt: Date.now(),
    expiresAt,
  });
}

export async function isJtiRevoked(jti: string): Promise<boolean> {
  if (!jti) return false;
  try {
    const snap = await getAdminDb().collection(REVOKED_COLLECTION).doc(jti).get();
    if (!snap.exists) return false;
    const data = snap.data();
    const expiresAt = typeof data?.expiresAt === "number" ? data.expiresAt : 0;
    if (expiresAt && Date.now() > expiresAt) return false;
    return true;
  } catch {
    return false;
  }
}
