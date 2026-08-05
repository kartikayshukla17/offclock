"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getLocalDateString, validateScheduleTimes, type Schedule } from "@/lib/schedule";

export function DayScheduleForm({
  schedule,
  loading,
  onSaved,
}: {
  schedule: Schedule | null;
  loading: boolean;
  onSaved: () => void;
}) {
  const { getIdToken } = useAuth();
  const [workStart, setWorkStart] = useState(schedule?.workStart ?? "");
  const [workEnd, setWorkEnd] = useState(schedule?.workEnd ?? "");
  const [hasLunch, setHasLunch] = useState(
    Boolean(schedule?.lunchStart && schedule?.lunchEnd),
  );
  const [lunchStart, setLunchStart] = useState(schedule?.lunchStart ?? "");
  const [lunchEnd, setLunchEnd] = useState(schedule?.lunchEnd ?? "");
  const [syncedSchedule, setSyncedSchedule] = useState(schedule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed local fields from `schedule` exactly once, the first time it
  // arrives non-null (the parent's initial fetch completing). After that,
  // this component's local state is authoritative — a later refetch
  // triggered by a DIFFERENT panel saving (e.g. status) must not wipe
  // whatever the user is mid-typing here. Do not change this to resync on
  // every `schedule` prop change.
  if (schedule !== null && syncedSchedule === null) {
    setSyncedSchedule(schedule);
    setWorkStart(schedule.workStart);
    setWorkEnd(schedule.workEnd);
    setHasLunch(Boolean(schedule.lunchStart && schedule.lunchEnd));
    setLunchStart(schedule.lunchStart ?? "");
    setLunchEnd(schedule.lunchEnd ?? "");
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (hasLunch && !lunchStart && !lunchEnd) {
      setError("Set both a lunch start and end time, or turn lunch off.");
      return;
    }

    const validationError = validateScheduleTimes({
      workStart,
      workEnd,
      lunchStart: hasLunch ? lunchStart : undefined,
      lunchEnd: hasLunch ? lunchEnd : undefined,
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
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: getLocalDateString(),
          workStart,
          workEnd,
          lunchStart: hasLunch ? lunchStart : undefined,
          lunchEnd: hasLunch ? lunchEnd : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save schedule.");
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
        <h2 className="font-medium text-stone-800">Today&apos;s schedule</h2>
        <p className="mt-2 text-sm text-stone-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-medium text-stone-800">Today&apos;s schedule</h2>

      <div className="mt-4 flex items-center gap-3">
        <label className="flex flex-col text-sm text-stone-600">
          Start
          <input
            type="time"
            value={workStart}
            onChange={(e) => setWorkStart(e.target.value)}
            className="mt-1 rounded-lg border border-stone-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col text-sm text-stone-600">
          End
          <input
            type="time"
            value={workEnd}
            onChange={(e) => setWorkEnd(e.target.value)}
            className="mt-1 rounded-lg border border-stone-300 px-2 py-1"
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-stone-600">
        <input
          type="checkbox"
          checked={hasLunch}
          onChange={(e) => setHasLunch(e.target.checked)}
        />
        Add lunch window
      </label>

      {hasLunch && (
        <div className="mt-2 flex items-center gap-3">
          <label className="flex flex-col text-sm text-stone-600">
            Lunch start
            <input
              type="time"
              value={lunchStart}
              onChange={(e) => setLunchStart(e.target.value)}
              className="mt-1 rounded-lg border border-stone-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm text-stone-600">
            Lunch end
            <input
              type="time"
              value={lunchEnd}
              onChange={(e) => setLunchEnd(e.target.value)}
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
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
