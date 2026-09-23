import "server-only";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY 未設定，無法存取 Firestore");
  }

  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(raw) as Parameters<typeof cert>[0];
    adminApp = initializeApp({ credential: cert(serviceAccount) });
  } else {
    adminApp = getApps()[0];
  }

  adminDb = getFirestore(adminApp);
  return adminDb;
}

export { FieldValue } from "firebase-admin/firestore";
