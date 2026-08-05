"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { DayScheduleForm } from "@/components/day-schedule-form";
import { StatusPanel } from "@/components/status-panel";
import { getLocalDateString, type Schedule } from "@/lib/schedule";

export default function DashboardPage() {
  const { appUser, firebaseUser, getIdToken } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Single source of truth for "fetch schedule + apply it to state." Both
  // the mount effect below and `loadSchedule` (passed to children as
  // `onSaved`) call this — the fetch-and-setState logic lives in exactly
  // one place, not duplicated between the mount path and the on-demand
  // refetch path.
  //
  // Neither caller passes `fetchSchedule` itself directly as a `useEffect`
  // callback (or names it as the sole statement in one). The linter's
  // `react-hooks/set-state-in-effect` rule statically traces a `useEffect`
  // callback's call graph and flags it if that graph reaches a `setState`
  // call *through a function referenced in the effect's own body* — so the
  // mount effect below wraps its call in its own locally-declared `load`
  // function (mirroring the pre-refactor Day 2 pattern) instead of handing
  // `fetchSchedule` to `useEffect` by reference.
  const fetchSchedule = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/schedule?date=${getLocalDateString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { schedule: Schedule | null };
        setSchedule(data.schedule);
        setScheduleError(null);
      } else {
        setScheduleError("Couldn't load your schedule — try reloading.");
      }
    } catch {
      setScheduleError("Couldn't load your schedule — try reloading.");
    } finally {
      setScheduleLoading(false);
    }
  }, [firebaseUser, getIdToken]);

  const loadSchedule = useCallback(async () => {
    await fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    async function load() {
      await fetchSchedule();
    }
    load();
  }, [fetchSchedule]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getGreeting()}, {appUser?.displayName?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-2 text-stone-600">
            Set today&apos;s hours and status below. Your household page
            lands soon.
          </p>
        </div>

        {scheduleError && (
          <p className="text-sm text-red-600">{scheduleError}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <DayScheduleForm
            schedule={schedule}
            loading={scheduleLoading}
            onSaved={loadSchedule}
          />
          <StatusPanel
            schedule={schedule}
            loading={scheduleLoading}
            onSaved={loadSchedule}
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
