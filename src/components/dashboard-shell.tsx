/* Hallmark · app chrome · design-system: design.md · designed-as-app */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { ShareLinkBanner } from "@/components/share-link-banner";

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
      <div className="flex min-h-full items-center justify-center bg-paper">
        <p className="text-sm text-muted">Loading…</p>
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
    <div className="min-h-full bg-paper text-ink">
      <header className="px-4 pt-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between rounded-full glass px-5 py-2.5 shadow-sm">
          <Link
            href="/dashboard"
            className="font-display text-sm font-bold tracking-tight"
          >
            OffClock
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink-2 sm:inline">
              {appUser?.displayName ?? appUser?.email}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="focus-ring rounded-full px-3 py-1.5 text-danger transition-colors hover:bg-danger-bg"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {appUser?.slug && shareUrl && pathname === "/dashboard" && (
          <ShareLinkBanner shareUrl={shareUrl} />
        )}
        {children}
      </main>
    </div>
  );
}
