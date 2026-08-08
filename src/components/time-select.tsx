/* Hallmark · component: time-select · genre: playful · theme: design.md
 * states: default · hover · focus · active(open) · disabled · error · filled
 * contrast: pass (40-41)
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = ["00", "15", "30", "45"];
const PERIODS = ["AM", "PM"] as const;
type Period = (typeof PERIODS)[number];

function toMinutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function to24Hour(hour12: number, period: Period): number {
  if (period === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function to12Hour(hour24: number): { hour12: number; period: Period } {
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, period };
}

function splitValue(value: string): { hour12: number | null; minute: string; period: Period } {
  if (!value) return { hour12: null, minute: "", period: "AM" };
  const [h, m] = value.split(":");
  const { hour12, period } = to12Hour(Number(h));
  return { hour12, minute: m ?? "", period };
}

function formatDisplay(value: string): string {
  if (!value) return "Select time";
  const { hour12, minute, period } = splitValue(value);
  return `${hour12}:${minute} ${period}`;
}

export function TimeSelect({
  value,
  onChange,
  label,
  disabled = false,
  disableBefore,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  /** HH:mm — any time before this is greyed out and unpickable. */
  disableBefore?: string;
}) {
  const [open, setOpen] = useState(false);
  const { hour12, minute, period } = splitValue(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const disableBeforeMinutes =
    disableBefore !== undefined ? toMinutesSinceMidnight(disableBefore) : null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function isDisabled(candidateHour12: number, candidateMinute: string, candidatePeriod: Period) {
    if (disableBeforeMinutes === null) return false;
    const hour24 = to24Hour(candidateHour12, candidatePeriod);
    return hour24 * 60 + Number(candidateMinute) < disableBeforeMinutes;
  }

  function pick(nextHour12: number, nextMinute: string, nextPeriod: Period) {
    const hour24 = to24Hour(nextHour12, nextPeriod);
    onChange(`${String(hour24).padStart(2, "0")}:${nextMinute}`);
  }

  const currentHour12 = hour12 ?? 12;
  const currentMinute = minute || "00";
  const currentPeriod = period;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`focus-ring flex h-11 w-full items-center justify-between gap-2 rounded-input border bg-paper px-3 text-sm transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-55 ${
          open ? "border-ink-2" : "border-rule hover:bg-paper-2"
        } ${value ? "text-ink" : "text-muted"}`}
      >
        <span className="font-mono">{formatDisplay(value)}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-muted"
        >
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 6v4l2.5 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label={`${label} picker`}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-20 flex w-60 flex-col gap-2 rounded-card border border-rule bg-paper p-2 shadow-lg"
        >
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={p === currentPeriod}
                onClick={() => pick(currentHour12, currentMinute, p)}
                className={`focus-ring flex-1 rounded-input px-2 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
                  p === currentPeriod
                    ? "bg-accent text-accent-ink"
                    : "text-ink-2 hover:bg-paper-2"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex h-48 min-h-0 gap-1">
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Hour
              </p>
              {HOURS_12.map((h) => {
                const everyMinuteDisabled = MINUTES.every((m) =>
                  isDisabled(h, m, currentPeriod),
                );
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={h === currentHour12}
                    disabled={everyMinuteDisabled}
                    onClick={() => pick(h, currentMinute, currentPeriod)}
                    className={`focus-ring rounded-input px-2 py-1 text-left font-mono text-sm transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:text-rule disabled:hover:bg-transparent ${
                      h === currentHour12
                        ? "bg-accent text-accent-ink"
                        : "text-ink-2 hover:bg-paper-2"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Min
              </p>
              {MINUTES.map((m) => {
                const minuteDisabled = isDisabled(currentHour12, m, currentPeriod);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={m === currentMinute}
                    disabled={minuteDisabled}
                    onClick={() => {
                      pick(currentHour12, m, currentPeriod);
                      setOpen(false);
                    }}
                    className={`focus-ring rounded-input px-2 py-1 text-left font-mono text-sm transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:text-rule disabled:hover:bg-transparent ${
                      m === currentMinute
                        ? "bg-accent text-accent-ink"
                        : "text-ink-2 hover:bg-paper-2"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
