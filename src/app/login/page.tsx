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
            className="focus-ring mt-6 flex w-full items-center justify-center gap-2 rounded-input border border-rule bg-paper py-3 text-sm font-medium text-ink transition-colors duration-150 ease-out hover:bg-paper-2 active:translate-y-px"
          >
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
