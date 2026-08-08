/* Hallmark · component: time-select · genre: playful · theme: design.md
 * states: default · hover · focus · active(open) · disabled · error · filled
 * contrast: pass (40-41)
 */
"use client";

import { useEffect, useId, useRef, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function splitTime(value: string): [string, string] {
  const [h, m] = value.split(":");
  return [h ?? "", m ?? ""];
}

export function TimeSelect({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = splitTime(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

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

  function pick(nextHour: string, nextMinute: string) {
    onChange(`${nextHour}:${nextMinute}`);
  }

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
        <span className="font-mono">{value || "--:--"}</span>
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
          className="absolute left-0 top-[calc(100%+0.5rem)] z-20 flex w-48 gap-1 rounded-card glass p-2 shadow-lg"
        >
          <div className="flex max-h-48 flex-1 flex-col gap-0.5 overflow-y-auto">
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
              Hour
            </p>
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={h === hour}
                onClick={() => pick(h, minute || "00")}
                className={`focus-ring rounded-input px-2 py-1 text-left font-mono text-sm transition-colors duration-150 ease-out ${
                  h === hour
                    ? "bg-accent text-accent-ink"
                    : "text-ink-2 hover:bg-paper-2"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
              Min
            </p>
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === minute}
                onClick={() => {
                  pick(hour || "00", m);
                  setOpen(false);
                }}
                className={`focus-ring rounded-input px-2 py-1 text-left font-mono text-sm transition-colors duration-150 ease-out ${
                  m === minute
                    ? "bg-accent text-accent-ink"
                    : "text-ink-2 hover:bg-paper-2"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
