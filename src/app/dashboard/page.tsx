"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { DayScheduleForm } from "@/components/day-schedule-form";
import { getLocalDateString, type Schedule } from "@/lib/schedule";

export default function DashboardPage() {
  const { appUser, firebaseUser, getIdToken } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
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

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getGreeting()}, {appUser?.displayName?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-2 text-stone-600">
            Set today&apos;s work hours below. Status toggles land tomorrow.
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
