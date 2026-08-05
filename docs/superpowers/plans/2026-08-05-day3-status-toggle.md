# Day 3 — Status Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in OffClock user set their current status (available / focused / in_meeting / off_clock), with an optional "until" time and short message, from the dashboard.

**Architecture:** Extend the existing `DaySchedule` Prisma row (not a new table) with a native Postgres enum and three nullable columns. A new `/api/schedule/status` PATCH route updates those fields on an *existing* row only (404 if today's hours haven't been set yet). On the frontend, lift the schedule fetch that currently lives inside `DayScheduleForm` up to `DashboardPage`, so both `DayScheduleForm` (existing) and the new `StatusPanel` share one fetch instead of duplicating it.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + Postgres (Neon), Firebase Auth, Tailwind CSS. No test framework in this project (documented, deliberate) — verification is via a throwaway Prisma script, a throwaway TS assertions script, curl for auth guards, and manual browser checks, same approach as Day 2.

## Global Constraints

- Status values are exactly `available`, `focused`, `in_meeting`, `off_clock` — no others.
- `statusUntil` is a plain `HH:mm` string (same convention as `workStart`/`workEnd`), no timezone handling.
- `statusMessage` is optional free text, capped at 80 characters (trimmed before the length check).
- The status route only ever `UPDATE`s an existing `DaySchedule` row for `(userId, date)` — it never creates one. No row for that date → `404 { error: "Set today's hours first." }`.
- Follow the existing API route convention exactly: `isFirebaseAdminConfigured()` → 503 if false → `getAuthUserFromRequest(request)` → 401 if no `uid` → user lookup → 404 if not found → then the route's own logic. Errors are always `{ error: string }` JSON.
- Reuse shared validators from `src/lib/schedule.ts` from both server and client code — do not duplicate validation logic inline in a component (Day 2's final review caught exactly this drift once; don't reintroduce it).
- UI follows the existing Tailwind style: `rounded-2xl border border-stone-200 bg-white p-5` cards (dashed border + `text-stone-500` for a disabled/placeholder state), stone-toned text, teal accents (`bg-teal-600`/`hover:bg-teal-700`) for primary actions and selected toggle state.
- Node is v22.17.0 — `node --env-file=.env.local <script>` works for one-off scripts needing `DATABASE_URL`; `npx --yes tsx <script>.ts` works for one-off TypeScript scripts with no permanent dependency added.

---

### Task 1: Add status fields to the Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create (temporary, deleted at end of task): `scripts/_verify-status-fields.mjs`

**Interfaces:**
- Produces: `ScheduleStatus` enum (`available`, `focused`, `in_meeting`, `off_clock`); `DaySchedule.status: ScheduleStatus | null`, `DaySchedule.statusUntil: String | null` (`@map("status_until")`), `DaySchedule.statusMessage: String | null` (`@map("status_message")`).

- [ ] **Step 1: Write the temporary verification script**

Create `scripts/_verify-status-fields.mjs`:

```js
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      firebaseUid: `verify-status-${Date.now()}`,
      email: `verify-status-${Date.now()}@example.com`,
    },
  });

  const created = await prisma.daySchedule.create({
    data: {
      userId: user.id,
      date: new Date("2026-08-05"),
      workStart: "09:00",
      workEnd: "17:00",
    },
  });

  assert.equal(created.status, null);

  const updated = await prisma.daySchedule.update({
    where: { id: created.id },
    data: {
      status: "in_meeting",
      statusUntil: "15:30",
      statusMessage: "Back after standup",
    },
  });

  assert.equal(updated.status, "in_meeting");
  assert.equal(updated.statusUntil, "15:30");
  assert.equal(updated.statusMessage, "Back after standup");

  const fetched = await prisma.daySchedule.findUnique({
    where: { id: created.id },
  });
  assert.equal(fetched?.status, "in_meeting");

  await prisma.daySchedule.delete({ where: { id: created.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("OK: DaySchedule status fields verified");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it to confirm it fails (fields don't exist yet)**

Run: `node --env-file=.env.local scripts/_verify-status-fields.mjs`
Expected: throws — Prisma rejects the `status`/`statusUntil`/`statusMessage` keys in the `update` call (an "Unknown argument" style validation error), since the schema doesn't have these fields yet.

- [ ] **Step 3: Add the enum and fields to the schema**

In `prisma/schema.prisma`, add the enum above the `DaySchedule` model:

```prisma
enum ScheduleStatus {
  available
  focused
  in_meeting
  off_clock
}
```

Then add these three fields to the `DaySchedule` model, right after `lunchEnd`:

```prisma
  status        ScheduleStatus?
  statusUntil   String?         @map("status_until")
  statusMessage String?         @map("status_message")
```

- [ ] **Step 4: Validate and push the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Run: `npm run db:push`
Expected: reports the `day_schedules` table altered (new columns + enum type added), ends with "Your database is now in sync with your Prisma schema."

- [ ] **Step 5: Run the verification script again to confirm it passes**

Run: `node --env-file=.env.local scripts/_verify-status-fields.mjs`
Expected: prints `OK: DaySchedule status fields verified` and exits 0.

- [ ] **Step 6: Delete the temporary script**

Run: `rm scripts/_verify-status-fields.mjs`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ScheduleStatus enum and status fields to DaySchedule"
```

---

### Task 2: Status validation helpers and shared Schedule type

**Files:**
- Modify: `src/lib/schedule.ts`
- Create (temporary, deleted at end of task): `scripts/_verify-status-lib.ts`

**Interfaces:**
- Consumes: nothing new (adds to the existing pure module; may use the existing private `isValidTime`, already exported).
- Produces (from `src/lib/schedule.ts`, used by Task 3, Task 4, and Task 5):
  - `SCHEDULE_STATUSES: readonly ["available", "focused", "in_meeting", "off_clock"]`
  - `ScheduleStatusValue` — the union type of the four status strings
  - `isValidStatus(value: string): value is ScheduleStatusValue`
  - `validateStatusUpdate(input: { status: string; statusUntil?: string; statusMessage?: string }): string | null`
  - `Schedule` type — `{ workStart: string; workEnd: string; lunchStart: string | null; lunchEnd: string | null; status: ScheduleStatusValue | null; statusUntil: string | null; statusMessage: string | null }`

- [ ] **Step 1: Write the failing verification script**

Create `scripts/_verify-status-lib.ts`:

```ts
import assert from "node:assert/strict";
import {
  isValidStatus,
  validateStatusUpdate,
  SCHEDULE_STATUSES,
} from "../src/lib/schedule";

assert.deepEqual(SCHEDULE_STATUSES, [
  "available",
  "focused",
  "in_meeting",
  "off_clock",
]);

assert.equal(isValidStatus("available"), true);
assert.equal(isValidStatus("off_clock"), true);
assert.equal(isValidStatus("on_vacation"), false);
assert.equal(isValidStatus(""), false);

assert.equal(validateStatusUpdate({ status: "focused" }), null);
assert.equal(
  validateStatusUpdate({
    status: "in_meeting",
    statusUntil: "15:30",
    statusMessage: "Back soon",
  }),
  null,
);
assert.ok(validateStatusUpdate({ status: "not_a_status" }));
assert.ok(validateStatusUpdate({ status: "focused", statusUntil: "3:30pm" }));
assert.ok(
  validateStatusUpdate({ status: "focused", statusMessage: "x".repeat(81) }),
);
assert.equal(
  validateStatusUpdate({ status: "focused", statusMessage: "x".repeat(80) }),
  null,
);

console.log("OK: status validation helpers verified");
```

- [ ] **Step 2: Run it to confirm it fails (functions don't exist yet)**

Run: `npx --yes tsx scripts/_verify-status-lib.ts`
Expected: fails — `isValidStatus`/`validateStatusUpdate`/`SCHEDULE_STATUSES` are not exported from `../src/lib/schedule` yet.

- [ ] **Step 3: Add the helpers and type to `src/lib/schedule.ts`**

Append this to the end of the existing `src/lib/schedule.ts` (after `validateScheduleTimes`, do not remove or modify anything already in the file):

```ts
export const SCHEDULE_STATUSES = [
  "available",
  "focused",
  "in_meeting",
  "off_clock",
] as const;

export type ScheduleStatusValue = (typeof SCHEDULE_STATUSES)[number];

export function isValidStatus(value: string): value is ScheduleStatusValue {
  return (SCHEDULE_STATUSES as readonly string[]).includes(value);
}

export function validateStatusUpdate(input: {
  status: string;
  statusUntil?: string;
  statusMessage?: string;
}): string | null {
  if (!isValidStatus(input.status)) {
    return "Status must be one of: available, focused, in_meeting, off_clock.";
  }
  if (
    input.statusUntil !== undefined &&
    input.statusUntil !== "" &&
    !isValidTime(input.statusUntil)
  ) {
    return "Until time must be a valid time (HH:mm).";
  }
  if (
    input.statusMessage !== undefined &&
    input.statusMessage.trim().length > 80
  ) {
    return "Message must be 80 characters or less.";
  }
  return null;
}

export type Schedule = {
  workStart: string;
  workEnd: string;
  lunchStart: string | null;
  lunchEnd: string | null;
  status: ScheduleStatusValue | null;
  statusUntil: string | null;
  statusMessage: string | null;
};
```

- [ ] **Step 4: Run the verification script again to confirm it passes**

Run: `npx --yes tsx scripts/_verify-status-lib.ts`
Expected: prints `OK: status validation helpers verified` and exits 0.

- [ ] **Step 5: Delete the temporary script**

Run: `rm scripts/_verify-status-lib.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule.ts
git commit -m "feat: add status validation helpers and shared Schedule type"
```

---

### Task 3: `/api/schedule/status` route (PATCH)

**Files:**
- Create: `src/app/api/schedule/status/route.ts`

**Interfaces:**
- Consumes: `getAuthUserFromRequest` (`src/lib/auth/request.ts`), `isFirebaseAdminConfigured` (`src/lib/firebase/admin.ts`), `prisma` (`src/lib/prisma.ts`), `prisma.daySchedule` (Task 1's new fields), `getLocalDateString`/`validateStatusUpdate`/`ScheduleStatusValue` (Task 2).
- Produces: `PATCH /api/schedule/status` (Bearer token required, JSON body `{ date?: string, status: string, statusUntil?: string, statusMessage?: string }`) → `200 { schedule }` / `400 { error }` / `401 { error }` / `404 { error: "Set today's hours first." }` / `503 { error }`.

- [ ] **Step 1: Implement the route**

Create `src/app/api/schedule/status/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import {
  getLocalDateString,
  validateStatusUpdate,
  type ScheduleStatusValue,
} from "@/lib/schedule";

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export async function PATCH(request: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Server auth is not configured." },
      { status: 503 },
    );
  }

  const decoded = await getAuthUserFromRequest(request);
  if (!decoded?.uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { firebaseUid: decoded.uid },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    date?: string;
    status?: string;
    statusUntil?: string;
    statusMessage?: string;
  };

  if (typeof body.status !== "string") {
    return NextResponse.json(
      { error: "status is required." },
      { status: 400 },
    );
  }

  if (
    body.date !== undefined &&
    (typeof body.date !== "string" || !DATE_RE.test(body.date))
  ) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  const validationError = validateStatusUpdate({
    status: body.status,
    statusUntil: body.statusUntil,
    statusMessage: body.statusMessage,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const date = body.date ?? getLocalDateString();

  const existing = await prisma.daySchedule.findUnique({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Set today's hours first." },
      { status: 404 },
    );
  }

  const schedule = await prisma.daySchedule.update({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
    data: {
      status: body.status as ScheduleStatusValue,
      statusUntil: body.statusUntil || null,
      statusMessage: body.statusMessage?.trim() || null,
    },
  });

  return NextResponse.json({ schedule });
}
```

- [ ] **Step 2: Verify the auth guard with the dev server running**

Run: `npm run dev` (leave running in the background)

Then, in another terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"status":"focused"}' \
  http://localhost:3000/api/schedule/status
```

Expected: `401` (no `Authorization` header). This confirms the guard order and that the route compiles/loads. The authenticated success path and the 404 "no schedule yet" path require a real Firebase ID token from a signed-in session — verified manually in Task 5, once the UI exists.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/schedule/status/route.ts
git commit -m "feat: add /api/schedule/status PATCH route"
```

---

### Task 4: Lift the schedule fetch to DashboardPage

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/day-schedule-form.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ appUser, firebaseUser, getIdToken }`, `getLocalDateString` and `type Schedule` (Task 2), `GET /api/schedule` (existing route, already returns the new status fields once Task 1 lands, no server change needed for `GET` to include them).
- Produces: `DashboardPage` now owns `schedule: Schedule | null`, `scheduleLoading: boolean`, `scheduleError: string | null` state and a stable `loadSchedule: () => Promise<void>` callback, passed to children as `schedule`, `loading`, `onSaved` props. `DayScheduleForm` becomes `DayScheduleForm({ schedule, loading, onSaved }: { schedule: Schedule | null; loading: boolean; onSaved: () => void })` — no longer fetches on its own.

This task is a pure refactor — it must not change what Day 2's schedule form does or looks like from a user's perspective. The only thing moving is *where* the data comes from.

- [ ] **Step 1: Move the fetch from `DayScheduleForm` into `DashboardPage`**

Replace the full contents of `src/app/dashboard/page.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/components/auth-provider";
import { DayScheduleForm } from "@/components/day-schedule-form";
import { getLocalDateString, type Schedule } from "@/lib/schedule";

export default function DashboardPage() {
  const { appUser, firebaseUser, getIdToken } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
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
    loadSchedule();
  }, [loadSchedule]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {getGreeting()}, {appUser?.displayName?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-2 text-stone-600">
            Set today&apos;s work hours below. Status toggles land tomorrow.
          </p>
        </div>

        {scheduleError && (
          <p className="text-sm text-red-600">{scheduleError}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <DayScheduleForm
            schedule={schedule}
            loading={scheduleLoading}
            onSaved={loadSchedule}
          />
          <PlaceholderCard
            title="Your status"
            detail="Available / Focused / In meeting — Day 3"
          />
          <PlaceholderCard
            title="Household page"
            detail="Public share view — Day 4"
          />
          <PlaceholderCard
            title="Shutdown ritual"
            detail="Off the clock flow — Day 6"
          />
        </div>
      </div>
    </DashboardShell>
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
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5">
      <h2 className="font-medium text-stone-800">{title}</h2>
      <p className="mt-2 text-sm text-stone-500">{detail}</p>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
```

Note: the "Your status" placeholder card and the header copy ("Status toggles land tomorrow") are deliberately left as-is here — Task 5 replaces the placeholder and updates the copy once `StatusPanel` actually exists. This task only moves the fetch; it doesn't add the new feature.

- [ ] **Step 2: Rewrite `DayScheduleForm` to consume props instead of fetching**

Replace the full contents of `src/components/day-schedule-form.tsx` with:

```tsx
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
```

The only behavioral additions versus the current file: the local `Schedule` type is now imported from `@/lib/schedule` instead of declared inline, initial state reads from the `schedule` prop instead of empty strings, the seed-once block replaces the old `useEffect`-based fetch, and `handleSave` calls `onSaved()` after a successful save (in addition to `setSaved(true)`) so the parent's schedule state — and, once Task 5 lands, `StatusPanel` — reflect the new hours immediately.

- [ ] **Step 3: Typecheck, lint, and confirm the dev server compiles the page**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

Run: `npm run dev` (backgrounded), then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: `200` (or a redirect status if unauthenticated — either way, no 500/build error). Stop the dev server when done.

- [ ] **Step 4: Manual verification note**

This refactor cannot be fully verified without a real signed-in browser session (same limitation as Day 2). In your report, state plainly that the "does Day 2's hours-setting flow still work exactly as before" check was not performed live, and needs a human with a real session — this will be bundled with Task 5's own manual-verification note into one combined checklist at the end.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/day-schedule-form.tsx
git commit -m "refactor: lift schedule fetch from DayScheduleForm into DashboardPage"
```

---

### Task 5: StatusPanel component

**Files:**
- Create: `src/components/status-panel.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ getIdToken }`, `SCHEDULE_STATUSES`/`ScheduleStatusValue`/`isValidTime`/`getLocalDateString`/`type Schedule` (Task 2), `PATCH /api/schedule/status` (Task 3), `schedule`/`loading`/`onSaved` props from `DashboardPage` (Task 4).
- Produces: `StatusPanel` component (named export), rendered inside `DashboardPage` in place of the "Your status" placeholder card.

- [ ] **Step 1: Create the status panel component**

Create `src/components/status-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  SCHEDULE_STATUSES,
  getLocalDateString,
  isValidTime,
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
    if (statusUntil && !isValidTime(statusUntil)) {
      setError("Until time must be a valid time (HH:mm).");
      return;
    }
    if (statusMessage.trim().length > 80) {
      setError("Message must be 80 characters or less.");
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
            onClick={() => setSelectedStatus(status)}
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
```

- [ ] **Step 2: Wire it into the dashboard, replacing the Day 3 placeholder card**

In `src/app/dashboard/page.tsx`, add the import alongside the existing `DayScheduleForm` import:

```tsx
import { StatusPanel } from "@/components/status-panel";
```

Replace this block:

```tsx
          <PlaceholderCard
            title="Your status"
            detail="Available / Focused / In meeting — Day 3"
          />
```

with:

```tsx
          <StatusPanel
            schedule={schedule}
            loading={scheduleLoading}
            onSaved={loadSchedule}
          />
```

Also update the header copy — replace:

```tsx
          <p className="mt-2 text-stone-600">
            Set today&apos;s work hours below. Status toggles land tomorrow.
          </p>
```

with:

```tsx
          <p className="mt-2 text-stone-600">
            Set today&apos;s hours and status below. Your household page
            lands soon.
          </p>
```

- [ ] **Step 3: Typecheck, lint, and confirm the dev server compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

Run: `npm run dev` (backgrounded), then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard`
Expected: no 500/build error. Stop the dev server when done.

- [ ] **Step 4: Manual end-to-end verification note**

Same limitation as every prior UI task in this project: no real Firebase session or browser is available in this environment, so the full flow (set hours, then set a status with until+message, save, reload, confirm persistence; switch status; try `off_clock` with no until/message; try a >80-char message and confirm it's rejected client-side; confirm Task 4's refactor didn't break Day 2's hours-setting flow) was not run live. State this plainly in your report — it needs a human with a real session to close out Day 3.

- [ ] **Step 5: Commit**

```bash
git add src/components/status-panel.tsx src/app/dashboard/page.tsx
git commit -m "feat: add status panel to dashboard"
```

---

## After this plan

Per `docs/BUILD-PLAN.md`, Day 3 also calls for a build-in-public post ("Screenshot of dashboard, early UI OK") — a content step, not a code task. Per the calendar, OffClock has no scheduled X slot on Day 3 itself (Notarize Doctor takes Wednesday); this screenshot is more naturally paired with whichever day's slot comes next, once a human has actually seen the status panel working.

Day 4 (public `/s/[slug]` share page) is the next code task after this plan lands — it will read `workStart`/`workEnd`/`lunchStart`/`lunchEnd`/`status`/`statusUntil`/`statusMessage` all from the same `DaySchedule` row this plan extends.
