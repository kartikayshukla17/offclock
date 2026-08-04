import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let authInstance: Auth | undefined;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase client env vars are not configured.");
  }
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;

  const app = getFirebaseApp();

  if (typeof window === "undefined") {
    throw new Error("Firebase Auth is only available in the browser.");
  }

  try {
    authInstance = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Hot reload can initialize auth before this module re-runs.
    authInstance = getAuth(app);
  }

  return authInstance;
}
