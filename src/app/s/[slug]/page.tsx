"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { STATUS_LABELS, isStatusUntilStale } from "@/lib/schedule";

type ShareData = {
  displayName: string | null;
  hasSchedule: boolean;
  workStart?: string;
  workEnd?: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  status?: "available" | "focused" | "in_meeting" | "off_clock" | null;
  statusUntil?: string | null;
  statusMessage?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  available: "bg-teal-100 text-teal-900",
  focused: "bg-amber-100 text-amber-900",
  in_meeting: "bg-red-100 text-red-900",
  off_clock: "bg-stone-200 text-stone-700",
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
        const res = await fetch(`/api/s/${slug}`);
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
      <div className="flex min-h-full items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-full items-center justify-center bg-stone-50 px-4">
        <p className="text-center text-stone-600">This link isn&apos;t valid.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-full items-center justify-center bg-stone-50 px-4">
        <p className="text-center text-stone-600">
          Couldn&apos;t load this page — try reloading.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-stone-50 px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        {data.displayName ?? "This household"}
      </h1>

      {!data.hasSchedule ? (
        <p className="mt-6 text-stone-500">Hasn&apos;t set up today&apos;s schedule yet.</p>
      ) : (
        <div className="mt-6 w-full max-w-sm space-y-4">
          {data.status && (
            <div
              className={`rounded-2xl px-6 py-5 text-xl font-semibold ${STATUS_COLORS[data.status]}`}
            >
              {STATUS_LABELS[data.status]}
              {data.statusUntil && !isStatusUntilStale(data.statusUntil) && (
                <span className="block text-sm font-normal">
                  until {data.statusUntil}
                </span>
              )}
            </div>
          )}

          {data.statusMessage && (
            <p className="text-stone-700">{data.statusMessage}</p>
          )}

          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
            <p>
              Working {data.workStart}–{data.workEnd}
            </p>
            {data.lunchStart && data.lunchEnd && (
              <p className="mt-1">
                Lunch {data.lunchStart}–{data.lunchEnd}
              </p>
            )}
          </div>
        </div>
      )}

      {showTroubleNote && (
        <p className="mt-6 text-xs text-stone-400">
          Having trouble updating — showing the last known status.
        </p>
      )}
    </div>
  );
}
