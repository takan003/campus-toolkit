import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

function createAuth(): Auth | null {
  if (!firebaseConfig.apiKey) {
    return null;
  }
  try {
    return getAuth(app);
  } catch (error) {
    console.error("Firebase Auth 初始化失敗:", error);
    return null;
  }
}

export const auth = createAuth();
export const googleProvider = new GoogleAuthProvider();

export async function ensureSignedOut(): Promise<void> {
  if (!auth?.currentUser) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Firebase signOut 失敗:", error);
  }
}
