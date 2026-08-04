"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { normalizeSlug } from "@/lib/slug";

export default function SetupPage() {
  const router = useRouter();
  const { appUser, getIdToken, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncedAppUser, setSyncedAppUser] = useState(appUser);

  if (appUser !== syncedAppUser) {
    setSyncedAppUser(appUser);
    setDisplayName(appUser?.displayName ?? "");
    setSlug(appUser?.slug ?? "");
  }

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
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Set up your page</h1>
        <p className="mt-2 text-sm text-stone-600">
          This is the name and link your household will see.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Your name</span>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Kartikay"
              className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none ring-teal-600 focus:ring-2"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-700">Household link</span>
            <div className="mt-1 flex overflow-hidden rounded-xl border border-stone-300">
              <span className="flex items-center bg-stone-100 px-3 text-stone-500">
                /s/
              </span>
              <input
                required
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                      .replace(/-+/g, "-"),
                  )
                }
                onBlur={() => setSlug(normalizeSlug(slug))}
                placeholder="kartikay-household"
                className="flex-1 px-3 py-3 outline-none"
              />
            </div>
            <span className="mt-1 block text-xs text-stone-500">
              Lowercase letters, numbers, hyphens — e.g. kartikay-household
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-teal-700 py-3 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Continue to dashboard"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
