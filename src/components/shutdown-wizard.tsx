/* Hallmark · app component · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { TimeSelect } from "@/components/time-select";
import {
  getTomorrowDateString,
  validateScheduleTimes,
  type Schedule,
} from "@/lib/schedule";

export function ShutdownWizard({
  todaySchedule,
  onClose,
}: {
  todaySchedule: Schedule | null;
  onClose: () => void;
}) {
  const { getIdToken } = useAuth();
  const [step, setStep] = useState(0);
  const [looseThought, setLooseThought] = useState("");
  const [priority1, setPriority1] = useState("");
  const [priority2, setPriority2] = useState("");
  const [priority3, setPriority3] = useState("");
  const [workStart, setWorkStart] = useState(todaySchedule?.workStart ?? "");
  const [workEnd, setWorkEnd] = useState(todaySchedule?.workEnd ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleConfirm() {
    setError(null);

    const validationError = validateScheduleTimes({ workStart, workEnd });
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
          date: getTomorrowDateString(),
          workStart,
          workEnd,
          topPriority1: priority1 || undefined,
          topPriority2: priority2 || undefined,
          topPriority3: priority3 || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save tomorrow's plan.");
        return;
      }
      onClose();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shutdown ritual"
        className="w-full max-w-md rounded-card bg-paper p-6 shadow-lg"
      >
        {step === 0 && (
          <>
            <h2 className="font-display text-lg font-semibold text-ink">
              What&apos;s still on your mind?
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Write it down and let it go. This isn&apos;t saved anywhere.
            </p>
            <textarea
              value={looseThought}
              onChange={(e) => setLooseThought(e.target.value)}
              rows={4}
              className="focus-ring mt-4 w-full rounded-input border border-rule bg-paper px-3 py-2 text-sm text-ink"
              placeholder="Anything left undone, unresolved, or nagging..."
            />
            <WizardFooter
              onClose={onClose}
              onNext={() => setStep(1)}
              nextLabel="Next"
            />
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-display text-lg font-semibold text-ink">
              Tomorrow&apos;s top 3
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Optional — name up to three priorities.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <input
                value={priority1}
                onChange={(e) => setPriority1(e.target.value)}
                placeholder="Priority 1"
                className="focus-ring h-11 rounded-input border border-rule bg-paper px-3 text-sm text-ink"
              />
              <input
                value={priority2}
                onChange={(e) => setPriority2(e.target.value)}
                placeholder="Priority 2"
                className="focus-ring h-11 rounded-input border border-rule bg-paper px-3 text-sm text-ink"
              />
              <input
                value={priority3}
                onChange={(e) => setPriority3(e.target.value)}
                placeholder="Priority 3"
                className="focus-ring h-11 rounded-input border border-rule bg-paper px-3 text-sm text-ink"
              />
            </div>
            <WizardFooter
              onClose={onClose}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
              nextLabel="Next"
            />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-lg font-semibold text-ink">
              Confirm tomorrow&apos;s hours
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Defaults to today&apos;s hours — edit if tomorrow&apos;s different.
            </p>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex flex-1 flex-col text-sm text-ink-2">
                <span>Start</span>
                <div className="mt-1">
                  <TimeSelect
                    label="Tomorrow's start"
                    value={workStart}
                    onChange={setWorkStart}
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col text-sm text-ink-2">
                <span>End</span>
                <div className="mt-1">
                  <TimeSelect
                    label="Tomorrow's end"
                    value={workEnd}
                    onChange={setWorkEnd}
                  />
                </div>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            <WizardFooter
              onClose={onClose}
              onBack={() => setStep(1)}
              onNext={handleConfirm}
              nextLabel={saving ? "Saving…" : "Confirm"}
              nextDisabled={saving}
            />
          </>
        )}
      </div>
    </div>
  );
}

function WizardFooter({
  onClose,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onClose: () => void;
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <button
        type="button"
        onClick={onClose}
        className="focus-ring rounded-pill px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
      >
        Cancel
      </button>
      <div className="flex gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="focus-ring rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="focus-ring rounded-pill bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.02] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
