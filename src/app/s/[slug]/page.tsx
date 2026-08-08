/* Hallmark · content page · design-system: design.md · designed-as-app
 * status colours: available oklch(70% 0.11 165) · focused oklch(75% 0.11 75)
 * · meeting oklch(68% 0.15 25) · off oklch(85% 0.01 195)
 * pre-emit critique: P5 H5 E4 S4 R5 V4
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  STATUS_LABELS,
  isStatusUntilStale,
  getLocalDateString,
  type ScheduleStatusValue,
} from "@/lib/schedule";

type ShareData = {
  displayName: string | null;
  hasSchedule: boolean;
  workStart?: string;
  workEnd?: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  status?: ScheduleStatusValue | null;
  statusUntil?: string | null;
  statusMessage?: string | null;
};

const STATUS_STYLE: Record<
  ScheduleStatusValue,
  { bg: string; ink: string; icon: React.ReactNode }
> = {
  available: {
    bg: "bg-status-available",
    ink: "text-status-available-ink",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M4 10.5l4 4 8-9"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  focused: {
    bg: "bg-status-focused",
    ink: "text-status-focused-ink",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
        <circle cx="10" cy="10" r="2.4" fill="currentColor" />
      </svg>
    ),
  },
  in_meeting: {
    bg: "bg-status-meeting",
    ink: "text-status-meeting-ink",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <rect
          x="3.5"
          y="3.5"
          width="13"
          height="13"
          rx="3"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    ),
  },
  off_clock: {
    bg: "bg-status-off",
    ink: "text-status-off-ink",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M10 4v6l4 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
};

export default function SharePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<ShareData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const failureCount = useRef(0);
  const [showTroubleNote, setShowTroubleNote] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchShare() {
      try {
        const res = await fetch(
          `/api/s/${encodeURIComponent(slug)}?date=${getLocalDateString()}`,
        );
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as ShareData;
          setData(json);
          setNotFound(false);
          failureCount.current = 0;
          setShowTroubleNote(false);
        } else {
          failureCount.current += 1;
          if (failureCount.current >= 2) setShowTroubleNote(true);
        }
      } catch {
        if (!cancelled) {
          failureCount.current += 1;
          if (failureCount.current >= 2) setShowTroubleNote(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchShare();
    const interval = setInterval(fetchShare, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="share-backdrop flex min-h-full items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="share-backdrop flex min-h-full items-center justify-center px-4">
        <p className="rounded-card glass px-6 py-4 text-center text-ink-2">
          This link isn&apos;t valid.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="share-backdrop flex min-h-full items-center justify-center px-4">
        <p className="rounded-card glass px-6 py-4 text-center text-ink-2">
          Couldn&apos;t load this page — try reloading.
        </p>
      </div>
    );
  }

  const style = data.status ? STATUS_STYLE[data.status] : null;

  return (
    <div className="share-backdrop flex min-h-full flex-col items-center justify-center px-4 py-10 text-center">
      <div className="w-full max-w-sm rounded-card glass p-7">
        <h1 className="font-display min-w-0 text-2xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
          {data.displayName ?? "This household"}
        </h1>

        {!data.hasSchedule ? (
          <p className="mt-6 text-ink-2">
            Hasn&apos;t set up today&apos;s schedule yet.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {data.status && style && (
              <div
                className={`flex items-center justify-center gap-2 rounded-card px-6 py-5 text-xl font-semibold ${style.bg} ${style.ink}`}
              >
                {style.icon}
                <span>
                  {STATUS_LABELS[data.status]}
                  {data.statusUntil && !isStatusUntilStale(data.statusUntil) && (
                    <span className="block text-sm font-normal">
                      until {data.statusUntil}
                    </span>
                  )}
                </span>
              </div>
            )}

            {data.statusMessage && (
              <p className="text-ink-2">{data.statusMessage}</p>
            )}

            <div className="rounded-card border border-rule-2 bg-paper-2/60 p-5 text-sm text-ink-2">
              <p className="font-mono">
                Working {data.workStart}–{data.workEnd}
              </p>
              {data.lunchStart && data.lunchEnd && (
                <p className="mt-1 font-mono">
                  Lunch {data.lunchStart}–{data.lunchEnd}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showTroubleNote && (
        <p className="mt-6 text-xs text-muted">
          Having trouble updating — showing the last known status.
        </p>
      )}
    </div>
  );
}
