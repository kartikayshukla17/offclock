"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  slug: string | null;
};

type AuthContextValue = {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  configured: boolean;
  syncError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncUser(token: string): Promise<AppUser> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to sync user");
  }
  const data = (await res.json()) as { user: AppUser };
  return data.user;
}

async function getTokenWithRetry(user: User, attempts = 3): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await user.getIdToken();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : "";
      if (!message.includes("Database is closing/hidden") || i === attempts - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (i + 1)));
    }
  }
  throw lastError;
}

async function fetchProfile(token: string): Promise<AppUser> {
  const res = await fetch("/api/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to load profile");
  }
  const data = (await res.json()) as { user: AppUser };
  return data.user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const configured = isFirebaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const profile = await fetchProfile(token);
    setAppUser(profile);
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setSyncError(null);

      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      try {
        const token = await getTokenWithRetry(user);
        const synced = await syncUser(token);
        setAppUser(synced);
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Sync failed");
        setAppUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [configured]);

  const getIdToken = useCallback(async () => {
    if (!configured) return null;
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      configured,
      syncError,
      getIdToken,
      refreshProfile,
      signInWithGoogle: async () => {
        const auth = getFirebaseAuth();
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      signInWithEmail: async (email, password) => {
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUpWithEmail: async (email, password) => {
        const auth = getFirebaseAuth();
        await createUserWithEmailAndPassword(auth, email, password);
      },
      logout: async () => {
        const auth = getFirebaseAuth();
        await signOut(auth);
      },
    }),
    [
      firebaseUser,
      appUser,
      loading,
      configured,
      syncError,
      getIdToken,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
