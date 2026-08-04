"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const { appUser } = useAuth();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getGreeting()}, {appUser?.displayName?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-2 text-stone-600">
            Day 1 dashboard. Tomorrow we add today&apos;s work hours and lunch
            window.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceholderCard
            title="Today's schedule"
            detail="Work start / end + lunch — Day 2"
          />
          <PlaceholderCard
            title="Your status"
            detail="Available / Focused / In meeting — Day 3"
          />
          <PlaceholderCard
            title="Household page"
            detail="Public share view — Day 4"
          />
          <PlaceholderCard
            title="Shutdown ritual"
            detail="Off the clock flow — Day 6"
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function PlaceholderCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5">
      <h2 className="font-medium text-stone-800">{title}</h2>
      <p className="mt-2 text-sm text-stone-500">{detail}</p>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
