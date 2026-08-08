/* Hallmark · app component · design-system: design.md · designed-as-app */
"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { TimeSelect } from "@/components/time-select";
import {
  SCHEDULE_STATUSES,
  STATUS_LABELS,
  getLocalDateString,
  validateStatusUpdate,
  type Schedule,
  type ScheduleStatusValue,
} from "@/lib/schedule";

export function StatusPanel({
  schedule,
  loading,
  onSaved,
}: {
  schedule: Schedule | null;
  loading: boolean;
  onSaved: () => void;
}) {
  const { getIdToken } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<ScheduleStatusValue | null>(
    schedule?.status ?? null,
  );
  const [statusUntil, setStatusUntil] = useState(schedule?.statusUntil ?? "");
  const [statusMessage, setStatusMessage] = useState(
    schedule?.statusMessage ?? "",
  );
  const [syncedSchedule, setSyncedSchedule] = useState(schedule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Same seed-once pattern as DayScheduleForm — see the comment there.
  if (schedule !== null && syncedSchedule === null) {
    setSyncedSchedule(schedule);
    setSelectedStatus(schedule.status);
    setStatusUntil(schedule.statusUntil ?? "");
    setStatusMessage(schedule.statusMessage ?? "");
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!selectedStatus) {
      setError("Pick a status first.");
      return;
    }

    const validationError = validateStatusUpdate({
      status: selectedStatus,
      statusUntil: statusUntil || undefined,
      statusMessage: statusMessage.trim() || undefined,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setError("You're signed out — refresh and sign in again.");
        return;
      }
      const res = await fetch("/api/schedule/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: getLocalDateString(),
          status: selectedStatus,
          statusUntil: statusUntil || undefined,
          statusMessage: statusMessage.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save status.");
        return;
      }
      setSaved(true);
      onSaved();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-card glass p-5">
        <h2 className="font-display font-medium text-ink">Your status</h2>
        <p className="mt-2 text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="rounded-card border border-dashed border-rule p-5">
        <h2 className="font-display font-medium text-ink-2">Your status</h2>
        <p className="mt-2 text-sm text-muted">
          Set today&apos;s hours first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card glass p-5">
      <h2 className="font-display font-medium text-ink">Your status</h2>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {SCHEDULE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={selectedStatus === status}
            onClick={() => {
              setSelectedStatus(status);
              if (schedule?.status === status) {
                setStatusUntil(schedule.statusUntil ?? "");
                setStatusMessage(schedule.statusMessage ?? "");
              } else {
                setStatusUntil("");
                setStatusMessage("");
              }
            }}
            className={
              selectedStatus === status
                ? "focus-ring rounded-input bg-accent px-3 py-2 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out active:translate-y-px"
                : "focus-ring rounded-input border border-rule px-3 py-2 text-sm text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
            }
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {selectedStatus && (
        <div className="mt-4 space-y-3">
          <div className="flex max-w-[10rem] flex-col text-sm text-ink-2">
            <span>Until (optional)</span>
            <div className="mt-1">
              <TimeSelect
                label="Status until"
                value={statusUntil}
                onChange={setStatusUntil}
              />
            </div>
          </div>
          <label className="flex flex-col text-sm text-ink-2">
            Short message (optional)
            <input
              type="text"
              maxLength={80}
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="Back in 10"
              className="mt-1 rounded-input border border-rule bg-paper px-2 py-1.5 text-ink focus-ring outline-none placeholder:text-muted"
            />
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {saved && !error && (
        <p className="mt-3 text-sm text-accent">Saved.</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="focus-ring mt-4 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.02] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        {saving ? "Saving…" : "Save status"}
      </button>
    </div>
  );
}
