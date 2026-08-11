# Day 6 — Shutdown Ritual Wizard (Steps 1–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 3-step modal wizard, launched from the dashboard, that captures an unsaved "loose thought," tomorrow's top 3 priorities, and tomorrow's confirmed work hours — persisting the latter two to tomorrow's `DaySchedule` row.

**Architecture:** Task 1 extends the data layer — a schema migration (3 new nullable columns) and the existing `PUT /api/schedule` endpoint (already upserts by arbitrary date, just needs the 3 new fields wired through), plus a `getTomorrowDateString` helper. Task 2 builds the wizard UI itself (`src/components/shutdown-wizard.tsx`) and wires it into the dashboard, replacing the existing placeholder card.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 6 + Neon Postgres. No new dependencies.

## Global Constraints

- The loose-thought textarea (step 1) is never sent to the server and never persisted — it exists only in component state and is discarded when the modal closes.
- Tomorrow's top 3 priorities and confirmed hours are persisted via **one** `PUT /api/schedule` call on the wizard's final step, with `date` set to tomorrow — no new API endpoint.
- The modal is a solid `bg-paper` card over a dimmed scrim (not `.glass`) — an interactive overlay must occlude what's behind it, matching the QR-panel precedent from the Day 5 branch.
- Closes on Escape or backdrop click, no confirmation prompt (nothing of consequence is lost by closing early).
- No status change to `off_clock`, no completion timestamp, no display of the saved top-3 anywhere yet — all explicitly deferred to later tasks (Day 7 and beyond).

---

### Task 1: Schema + API — `topPriority1/2/3` and a tomorrow-date helper

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/schedule/route.ts`
- Modify: `src/lib/schedule.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DaySchedule.topPriority1/2/3: String?` (Prisma model fields, available on every `Schedule`-shaped API response from here on); `PUT /api/schedule` accepts optional `topPriority1?: string`, `topPriority2?: string`, `topPriority3?: string` in its JSON body; `getTomorrowDateString(date: Date = new Date()): string` exported from `src/lib/schedule.ts`, mirroring the existing `getLocalDateString`. Task 2 calls this helper and sends these three fields in its `PUT /api/schedule` request.

- [ ] **Step 1: Add the three columns to the Prisma schema**

In `prisma/schema.prisma`, find the `DaySchedule` model:

```prisma
model DaySchedule {
  id            String          @id @default(cuid())
  userId        String          @map("user_id")
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  date          DateTime        @db.Date
  workStart     String          @map("work_start")
  workEnd       String          @map("work_end")
  lunchStart    String?         @map("lunch_start")
  lunchEnd      String?         @map("lunch_end")
  status        ScheduleStatus?
  statusUntil   String?         @map("status_until")
  statusMessage String?         @map("status_message")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  @@unique([userId, date])
  @@map("day_schedules")
}
```

Add three fields after `statusMessage`:

```prisma
model DaySchedule {
  id            String          @id @default(cuid())
  userId        String          @map("user_id")
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  date          DateTime        @db.Date
  workStart     String          @map("work_start")
  workEnd       String          @map("work_end")
  lunchStart    String?         @map("lunch_start")
  lunchEnd      String?         @map("lunch_end")
  status        ScheduleStatus?
  statusUntil   String?         @map("status_until")
  statusMessage String?         @map("status_message")
  topPriority1  String?         @map("top_priority_1")
  topPriority2  String?         @map("top_priority_2")
  topPriority3  String?         @map("top_priority_3")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  @@unique([userId, date])
  @@map("day_schedules")
}
```

- [ ] **Step 2: Regenerate the Prisma Client**

Run: `npx prisma generate`

Expected: succeeds, no errors. This only reads `schema.prisma` locally — it does not require a database connection, so it works even without `DATABASE_URL` configured in this environment. Do NOT run `npx prisma db push` in this environment — there is no `.env.local` / `DATABASE_URL` available here (it's gitignored and not copied into an isolated workspace). The actual database push happens later, after this branch is merged into the main checkout where real credentials exist — leave a clear note about this in your report so the controller doesn't skip it.

- [ ] **Step 3: Add the three fields to the `PUT /api/schedule` request body type**

In `src/app/api/schedule/route.ts`, find:

```tsx
  const body = (await request.json()) as {
    date?: string;
    workStart?: string;
    workEnd?: string;
    lunchStart?: string;
    lunchEnd?: string;
  };
```

Replace with:

```tsx
  const body = (await request.json()) as {
    date?: string;
    workStart?: string;
    workEnd?: string;
    lunchStart?: string;
    lunchEnd?: string;
    topPriority1?: string;
    topPriority2?: string;
    topPriority3?: string;
  };
```

- [ ] **Step 4: Wire the three fields through the upsert**

In the same file, find:

```tsx
  const schedule = await prisma.daySchedule.upsert({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
    create: {
      userId: user.id,
      date: new Date(date),
      workStart: body.workStart,
      workEnd: body.workEnd,
      lunchStart: body.lunchStart || null,
      lunchEnd: body.lunchEnd || null,
    },
    update: {
      workStart: body.workStart,
      workEnd: body.workEnd,
      lunchStart: body.lunchStart || null,
      lunchEnd: body.lunchEnd || null,
    },
  });
```

Replace with:

```tsx
  const schedule = await prisma.daySchedule.upsert({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
    create: {
      userId: user.id,
      date: new Date(date),
      workStart: body.workStart,
      workEnd: body.workEnd,
      lunchStart: body.lunchStart || null,
      lunchEnd: body.lunchEnd || null,
      topPriority1: body.topPriority1 || null,
      topPriority2: body.topPriority2 || null,
      topPriority3: body.topPriority3 || null,
    },
    update: {
      workStart: body.workStart,
      workEnd: body.workEnd,
      lunchStart: body.lunchStart || null,
      lunchEnd: body.lunchEnd || null,
      topPriority1: body.topPriority1 || null,
      topPriority2: body.topPriority2 || null,
      topPriority3: body.topPriority3 || null,
    },
  });
```

Note: this means calling `PUT /api/schedule` for today's regular schedule save (from `DayScheduleForm`, which never sends `topPriority1/2/3`) will now write `null` into those three columns on today's row every time it saves — this is correct and intentional: `DayScheduleForm` and the shutdown wizard write to different date rows in the normal flow (today vs. tomorrow), so this only matters if a user runs the shutdown wizard for tomorrow and then, before that day arrives, edits "today's" schedule form while tomorrow has become today — an edge case that already null-safely resolves to clearing stale priorities on a schedule save, not a bug.

- [ ] **Step 5: Add `getTomorrowDateString` to `src/lib/schedule.ts`**

Find:

```ts
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

Add immediately after it:

```ts
export function getTomorrowDateString(date: Date = new Date()): string {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/app/api/schedule/route.ts src/lib/schedule.ts
git commit -m "feat: add topPriority fields + tomorrow-date helper for shutdown wizard"
```

---

### Task 2: Shutdown wizard component + dashboard wiring

**Files:**
- Create: `src/components/shutdown-wizard.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getTomorrowDateString`, `validateScheduleTimes`, `type Schedule` from `src/lib/schedule.ts` (Task 1); `TimeSelect` from `src/components/time-select.tsx`; `useAuth` from `src/components/auth-provider.tsx`; `PUT /api/schedule` now accepting `topPriority1/2/3` (Task 1).
- Produces: `ShutdownWizard({ todaySchedule, onClose }: { todaySchedule: Schedule | null; onClose: () => void })` — a named export, no other component depends on its internals.

- [ ] **Step 1: Create the wizard component**

Create `src/components/shutdown-wizard.tsx`:

```tsx
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
```

- [ ] **Step 2: Wire it into the dashboard**

In `src/app/dashboard/page.tsx`, add the import alongside the other component imports:

```tsx
import { ShutdownWizard } from "@/components/shutdown-wizard";
```

Add state alongside the existing `useState` declarations (after `scheduleError`):

```tsx
  const [showShutdownWizard, setShowShutdownWizard] = useState(false);
```

Replace the placeholder card:

```tsx
          <PlaceholderCard
            title="Shutdown ritual"
            detail="Off the clock flow — Day 6"
          />
```

with a real trigger button:

```tsx
          <button
            type="button"
            onClick={() => setShowShutdownWizard(true)}
            className="focus-ring rounded-card glass p-5 text-left transition-transform duration-150 ease-out hover:scale-[1.01]"
          >
            <h2 className="font-display font-medium text-ink">
              Shutdown ritual
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Close out today and plan tomorrow
            </p>
          </button>
```

Then change the component's `return` statement to render the wizard as a sibling of `DashboardShell` (the wizard is `fixed`-positioned, so it doesn't need to live inside the shell's layout). Find:

```tsx
  return (
    <DashboardShell>
      <div className="space-y-6">
```

and the matching closing:

```tsx
      </div>
    </DashboardShell>
  );
}
```

Wrap the whole thing in a fragment and add the conditional wizard render after `</DashboardShell>`:

```tsx
  return (
    <>
      <DashboardShell>
        <div className="space-y-6">
```

```tsx
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
```

(Only the opening `<DashboardShell>` line gains a `<>` wrapper above it, and the closing `</DashboardShell>` gains the conditional + `</>` below it — everything between stays exactly as it already is, just re-indented one level if your editor auto-indents; indentation drift alone is not a defect here.)

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npm run lint` — expect no errors.

- [ ] **Step 4: Dev-server smoke check**

Run `npm run dev` in the background, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard` — expect `200`. Stop the dev server afterward. This confirms the page compiles and renders — it does not exercise the wizard's actual save flow (that needs a live database, which this environment doesn't have; note that in your report as an outstanding manual-verification item, same as Task 1's `db push` note).

- [ ] **Step 5: Commit**

```bash
git add src/components/shutdown-wizard.tsx src/app/dashboard/page.tsx
git commit -m "feat: add shutdown ritual wizard (steps 1-3)"
```

---

## After this plan

Task 1 already pushed the `topPriority1/2/3` columns to the live shared dev Neon database from within its worktree (real `.env.local` credentials were copied in for this branch — see the ledger). **Do not skip the next step because of that.** The main checkout's `node_modules/.prisma` client is generated separately and has zero knowledge of the new columns until it's regenerated there too — this is the same stale-client failure mode from a prior branch (Day 3). After merging, run `npx prisma generate` (or `npm run db:push`, now a DB no-op but which regenerates the client as a side effect) **from the main checkout** before running `tsc` there, or the typecheck will fail on `topPriority1` not existing on `DayScheduleCreateInput`.

A human still needs to manually verify the full save flow with real credentials: step through the wizard, confirm tomorrow's hours actually land in tomorrow's `DaySchedule` row (via `GET /api/schedule?date=<tomorrow>` or by checking `npm run db:studio`), and confirm the loose-thought text never appears in any network request (check the browser's Network tab during step 1 → step 2 transition).

Day 7 (shutdown complete — the actual `off_clock` status flip and completion timestamp) is the next code task after this plan lands.
