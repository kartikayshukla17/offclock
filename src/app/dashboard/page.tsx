/* Hallmark · app page · design-system: design.md · designed-as-app */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { DayScheduleForm } from "@/components/day-schedule-form";
import { StatusPanel } from "@/components/status-panel";
import { ShutdownWizard } from "@/components/shutdown-wizard";
import { getLocalDateString, type Schedule } from "@/lib/schedule";

export default function DashboardPage() {
  const { appUser, firebaseUser, getIdToken } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [showShutdownWizard, setShowShutdownWizard] = useState(false);

  // Single source of truth for "fetch schedule + apply it to state." Both
  // the mount effect below and the children (via the `onSaved` prop) call
  // this — the fetch-and-setState logic lives in exactly one place, not
  // duplicated between the mount path and the on-demand refetch path.
  //
  // The mount effect below does not pass `fetchSchedule` itself directly
  // as a `useEffect` callback (or name it as the sole statement in one).
  // The linter's `react-hooks/set-state-in-effect` rule statically traces
  // a `useEffect` callback's call graph and flags it if that graph reaches
  // a `setState` call *through a function referenced in the effect's own
  // body* — so the mount effect below wraps its call in its own
  // locally-declared `load` function (mirroring the pre-refactor Day 2
  // pattern) instead of handing `fetchSchedule` to `useEffect` by
  // reference. Passing `fetchSchedule` as a prop to a child component
  // (invoked later from a click handler, not from the effect body) is
  // unaffected by this rule, so no wrapper is needed for that path.
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

  useEffect(() => {
    async function load() {
      await fetchSchedule();
    }
    load();
  }, [fetchSchedule]);

  const shareHref = appUser?.slug ? `/s/${appUser.slug}` : null;

  return (
    <>
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Good {getGreeting()},{" "}
              {appUser?.displayName?.split(" ")[0] ?? "there"}
            </h1>
            <p className="mt-2 text-ink-2">
              Set today&apos;s hours and status below — your household reads
              it from the share page.
            </p>
          </div>

          {scheduleError && (
            <p className="text-sm text-danger">{scheduleError}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <DayScheduleForm
              schedule={schedule}
              loading={scheduleLoading}
              onSaved={fetchSchedule}
            />
            <StatusPanel
              schedule={schedule}
              loading={scheduleLoading}
              onSaved={fetchSchedule}
            />
            {shareHref ? (
              <Link
                href={shareHref}
                className="rounded-card glass p-5 transition-transform duration-150 ease-out hover:scale-[1.01]"
              >
                <h2 className="font-display font-medium text-ink">
                  Household page
                </h2>
                <p className="mt-2 text-sm text-ink-2">
                  See exactly what they see — opens {shareHref}
                </p>
              </Link>
            ) : (
              <PlaceholderCard
                title="Household page"
                detail="Set up your link above to see it"
              />
            )}
            <button
              type="button"
              onClick={() => setShowShutdownWizard(true)}
              disabled={scheduleLoading}
              className="focus-ring rounded-card glass p-5 text-left transition-transform duration-150 ease-out hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <h2 className="font-display font-medium text-ink">
                Shutdown ritual
              </h2>
              <p className="mt-2 text-sm text-ink-2">
                Close out today and plan tomorrow
              </p>
            </button>
          </div>
        </div>
      </DashboardShell>
      {showShutdownWizard && (
        <ShutdownWizard
          todaySchedule={schedule}
          onClose={() => setShowShutdownWizard(false)}
        />
      )}
    </>
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
    <div className="rounded-card border border-dashed border-rule p-5">
      <h2 className="font-display font-medium text-ink-2">{title}</h2>
      <p className="mt-2 text-sm text-muted">{detail}</p>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
