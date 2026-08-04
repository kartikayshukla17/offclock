"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    if (!appUser?.slug && pathname !== "/setup") {
      router.replace("/setup");
    }
  }, [loading, firebaseUser, appUser, pathname, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-full items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">Loading…</p>
      </div>
    );
  }

  const shareUrl =
    appUser?.slug && process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/s/${appUser.slug}`
      : appUser?.slug
        ? `/s/${appUser.slug}`
        : null;

  return (
    <div className="min-h-full bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            OffClock
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-stone-500 sm:inline">
              {appUser?.displayName ?? appUser?.email}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg px-3 py-1.5 text-stone-600 hover:bg-stone-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {appUser?.slug && shareUrl && pathname === "/dashboard" && (
          <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
            Your household link:{" "}
            <Link href={shareUrl} className="font-medium underline">
              {shareUrl.replace(/^https?:\/\//, "")}
            </Link>
            <span className="mt-1 block text-teal-700">
              Share page goes live on Day 4 — link preview only for now.
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
