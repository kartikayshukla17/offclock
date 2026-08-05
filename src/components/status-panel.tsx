"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  SCHEDULE_STATUSES,
  getLocalDateString,
  validateStatusUpdate,
  type Schedule,
  type ScheduleStatusValue,
} from "@/lib/schedule";

const STATUS_LABELS: Record<ScheduleStatusValue, string> = {
  available: "Available",
  focused: "Focused",
  in_meeting: "In a meeting",
  off_clock: "Off the clock",
};

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
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-medium text-stone-800">Your status</h2>
        <p className="mt-2 text-sm text-stone-500">Loading…</p>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5">
        <h2 className="font-medium text-stone-800">Your status</h2>
        <p className="mt-2 text-sm text-stone-500">
          Set today&apos;s hours first.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-medium text-stone-800">Your status</h2>

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
                ? "rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white"
                : "rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
            }
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {selectedStatus && (
        <div className="mt-4 space-y-3">
          <label className="flex flex-col text-sm text-stone-600">
            Until (optional)
            <input
              type="time"
              value={statusUntil}
              onChange={(e) => setStatusUntil(e.target.value)}
              className="mt-1 rounded-lg border border-stone-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm text-stone-600">
            Short message (optional)
            <input
              type="text"
              maxLength={80}
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="Back in 10"
              className="mt-1 rounded-lg border border-stone-300 px-2 py-1"
            />
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="mt-3 text-sm text-teal-700">Saved.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save status"}
      </button>
    </div>
  );
}
