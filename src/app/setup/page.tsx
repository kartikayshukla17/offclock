/* Hallmark · app page · design-system: design.md · designed-as-app */
"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { normalizeSlug, validateSlug } from "@/lib/slug";

export default function SetupPage() {
  const router = useRouter();
  const { appUser, getIdToken, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncedAppUser, setSyncedAppUser] = useState(appUser);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkedSlug, setCheckedSlug] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const slugCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (appUser !== syncedAppUser) {
    setSyncedAppUser(appUser);
    setDisplayName(appUser?.displayName ?? "");
    setSlug(appUser?.slug ?? "");
  }

  useEffect(() => {
    if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current);

    if (!slug || slug === appUser?.slug || validateSlug(slug)) {
      return;
    }

    slugCheckTimeout.current = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch(
          `/api/profile/slug-check?slug=${encodeURIComponent(slug)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { available: boolean };
        setSlugAvailable(data.available);
        setCheckedSlug(slug);
      } catch {
        // Silent — the submit-time check still catches a taken slug.
      } finally {
        setCheckingSlug(false);
      }
    }, 400);

    return () => {
      if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current);
    };
  }, [slug, appUser?.slug, getIdToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in");

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          slug: normalizeSlug(slug),
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      await refreshProfile();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell>
      <div className="rounded-card glass p-6">
        <h1 className="font-display text-xl font-semibold">
          Set up your page
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          This is the name and link your household will see.
        </p>

        {error && (
          <p className="mt-4 rounded-input bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-ink">Your name</span>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Kartikay"
              className="mt-1 w-full rounded-input border border-rule bg-paper px-4 py-3 text-ink focus-ring outline-none placeholder:text-muted"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-ink">Household link</span>
            <div className="mt-1 flex overflow-hidden rounded-input border border-rule">
              <span className="flex items-center bg-paper-2 px-3 text-muted">
                /s/
              </span>
              <input
                required
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-"),
                  )
                }
                onBlur={() => setSlug(normalizeSlug(slug))}
                placeholder="kartikay-household"
                className="focus-ring flex-1 rounded-r-input bg-paper px-3 py-3 text-ink outline-none placeholder:text-muted"
              />
            </div>
            <span className="mt-1 block text-xs text-muted">
              We clean this up as you type — lowercase letters, numbers, and
              hyphens only.
            </span>
            {slug && slug !== appUser?.slug && !validateSlug(slug) && (
              <span
                className={`mt-1 block text-xs ${
                  checkingSlug
                    ? "text-muted"
                    : checkedSlug === slug && slugAvailable
                      ? "text-ink-2"
                      : "text-danger"
                }`}
              >
                {checkingSlug
                  ? "Checking…"
                  : checkedSlug === slug
                    ? slugAvailable
                      ? "Available"
                      : "Already taken"
                    : ""}
              </span>
            )}
          </label>

          <button
            type="submit"
            disabled={saving}
            className="focus-ring w-full rounded-input bg-accent py-3 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.01] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {saving ? "Saving…" : "Continue to dashboard"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
