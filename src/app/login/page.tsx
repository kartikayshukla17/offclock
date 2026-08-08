/* Hallmark · app page · design-system: design.md · designed-as-app */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const {
    firebaseUser,
    appUser,
    loading,
    configured,
    syncError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
  } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !firebaseUser) return;
    router.replace(appUser?.slug ? "/dashboard" : "/setup");
  }, [loading, firebaseUser, appUser, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <div className="flex min-h-full items-center justify-center bg-paper px-4">
        <div className="max-w-md rounded-card glass p-6 text-sm text-ink">
          <p className="font-display font-semibold">Firebase not configured</p>
          <p className="mt-2 text-ink-2">
            Copy <code className="rounded bg-paper-2 px-1">.env.example</code> to{" "}
            <code className="rounded bg-paper-2 px-1">.env.local</code> and add
            your Firebase + Neon credentials.
          </p>
          <Link href="/" className="mt-4 inline-block text-accent underline">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Link
          href="/"
          className="mb-8 text-sm text-muted transition-colors hover:text-ink"
        >
          ← OffClock
        </Link>

        <div className="rounded-card glass p-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Sign in to your dashboard
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Set up the page your household will open — no app install for
            them.
          </p>

          {(error || syncError) && (
            <p className="mt-4 rounded-input bg-danger-bg px-3 py-2 text-sm text-danger">
              {error ?? syncError}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setError(null);
              void signInWithGoogle().catch((err: unknown) => {
                setError(
                  err instanceof Error ? err.message : "Google sign-in failed",
                );
              });
            }}
            className="focus-ring mt-6 flex w-full items-center justify-center gap-2.5 rounded-input border border-rule bg-paper py-3 text-sm font-medium text-ink transition-colors duration-150 ease-out hover:bg-paper-2 active:translate-y-px"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62Z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="#FBBC05"
                d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33Z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-rule" />
            or email
            <div className="h-px flex-1 bg-rule" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-input border border-rule bg-paper px-4 py-3 text-sm text-ink focus-ring outline-none placeholder:text-muted"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-input border border-rule bg-paper px-4 py-3 text-sm text-ink focus-ring outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring w-full rounded-input bg-accent py-3 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.01] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {submitting
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="focus-ring mt-4 w-full rounded-input text-center text-sm text-ink-2 transition-colors hover:text-ink"
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
