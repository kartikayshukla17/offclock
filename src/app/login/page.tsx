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
      <div className="flex min-h-full items-center justify-center bg-stone-50 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
          <p className="font-medium">Firebase not configured</p>
          <p className="mt-2 text-amber-900">
            Copy <code className="rounded bg-white px-1">.env.example</code> to{" "}
            <code className="rounded bg-white px-1">.env.local</code> and add your
            Firebase + Neon credentials.
          </p>
          <Link href="/" className="mt-4 inline-block underline">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-stone-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Link href="/" className="mb-8 text-sm text-stone-500 hover:text-stone-800">
          ← OffClock
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to your dashboard
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Set up the page your household will open — no app install for them.
        </p>

        {(error || syncError) && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error ?? syncError}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setError(null);
            void signInWithGoogle().catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Google sign-in failed");
            });
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white py-3 text-sm font-medium hover:bg-stone-50"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-stone-400">
          <div className="h-px flex-1 bg-stone-200" />
          or email
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none ring-teal-600 focus:ring-2"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none ring-teal-600 focus:ring-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-teal-700 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
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
          className="mt-4 text-center text-sm text-stone-600 hover:text-stone-900"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
