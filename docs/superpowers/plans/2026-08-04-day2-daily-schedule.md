# Day 2 — Daily Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in OffClock user set today's work start/end time and an optional lunch window from the dashboard, persisted per user per calendar date.

**Architecture:** A new `DaySchedule` Prisma model (one row per `userId` + `date`, upserted) backs a new `/api/schedule` route (`GET`/`PUT`) that follows the exact guard/response shape of the existing `/api/profile` route. A small shared validation/date-formatting module (`src/lib/schedule.ts`) is consumed by both the API route (server-side validation) and the new dashboard form component (client-side pre-check). The form replaces the "Today's schedule" placeholder card already stubbed in `src/app/dashboard/page.tsx`.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + Postgres (Neon), Firebase Auth (existing `useAuth()` context), Tailwind CSS. No test framework exists in this project — verification steps below are direct schema/route checks (Prisma script, curl) plus manual browser checks, matching the project's existing (framework-free) testing approach. Do not add a test framework as part of this plan.

## Global Constraints

- Times are plain `HH:mm` strings tied to a plain calendar date — no timezone handling (v0.1 scope decision; see spec).
- Follow the existing Prisma convention: camelCase fields, `@map("snake_case")` columns, `@@map("snake_case_table")`.
- Follow the existing API route convention exactly (see `src/app/api/profile/route.ts`): guard order is `isFirebaseAdminConfigured()` → 503 if false → `getAuthUserFromRequest(request)` → 401 if no `uid` → Prisma call. Errors are always `{ error: string }` JSON.
- UI follows the existing Tailwind style: `rounded-2xl border border-stone-200 bg-white p-5` cards, stone-toned text, teal accents for primary actions (see `src/components/dashboard-shell.tsx` and `src/app/dashboard/page.tsx`).
- Node is v22.17.0 — `node --env-file=.env.local <script>` works for one-off scripts that need `DATABASE_URL`.
- Local git repo now exists at `offclock/` (initialized this session, first commit `6a2f43c`). No GitHub remote yet — that stays deferred to Day 4 per BUILD-PLAN.md. Commit after each task below.

---

### Task 1: Add `DaySchedule` to the Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create (temporary, deleted at end of task): `scripts/_verify-day-schedule.mjs`

**Interfaces:**
- Produces: `prisma.daySchedule` model — fields `id, userId, date, workStart, workEnd, lunchStart, lunchEnd, createdAt, updatedAt`; unique compound key `userId_date` (used as `{ userId_date: { userId, date } }` in `where` clauses). `User` gains `daySchedules: DaySchedule[]`.

- [ ] **Step 1: Write the temporary verification script**

Create `scripts/_verify-day-schedule.mjs`:

```js
import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      firebaseUid: `verify-${Date.now()}`,
      email: `verify-${Date.now()}@example.com`,
    },
  });

  const created = await prisma.daySchedule.create({
    data: {
      userId: user.id,
      date: new Date("2026-08-04"),
      workStart: "09:00",
      workEnd: "17:00",
      lunchStart: "12:30",
      lunchEnd: "13:00",
    },
  });

  const fetched = await prisma.daySchedule.findUnique({
    where: { userId_date: { userId: user.id, date: new Date("2026-08-04") } },
  });

  assert.equal(fetched?.workStart, "09:00");
  assert.equal(fetched?.lunchEnd, "13:00");

  await assert.rejects(() =>
    prisma.daySchedule.create({
      data: {
        userId: user.id,
        date: new Date("2026-08-04"),
        workStart: "10:00",
        workEnd: "18:00",
      },
    }),
  );

  await prisma.daySchedule.delete({ where: { id: created.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("OK: DaySchedule schema verified");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it to confirm it fails (schema doesn't exist yet)**

Run: `node --env-file=.env.local scripts/_verify-day-schedule.mjs`
Expected: throws — `prisma.daySchedule` is `undefined` (`TypeError: Cannot read properties of undefined`).

- [ ] **Step 3: Add the model to the schema**

In `prisma/schema.prisma`, add after the `User` model:

```prisma
model DaySchedule {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime @db.Date
  workStart   String   @map("work_start")
  workEnd     String   @map("work_end")
  lunchStart  String?  @map("lunch_start")
  lunchEnd    String?  @map("lunch_end")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([userId, date])
  @@map("day_schedules")
}
```

And add the back-relation to the existing `User` model (inside its braces, alongside the other fields):

```prisma
  daySchedules DaySchedule[]
```

- [ ] **Step 4: Validate and push the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Run: `npm run db:push`
Expected: reports the new `day_schedules` table created, ends with "Your database is now in sync with your Prisma schema."

- [ ] **Step 5: Run the verification script again to confirm it passes**

Run: `node --env-file=.env.local scripts/_verify-day-schedule.mjs`
Expected: prints `OK: DaySchedule schema verified` and exits 0.

- [ ] **Step 6: Delete the temporary script**

Run: `rm scripts/_verify-day-schedule.mjs`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add DaySchedule model"
```

---

### Task 2: Shared schedule validation/date helpers

**Files:**
- Create: `src/lib/schedule.ts`
- Create (temporary, deleted at end of task): `scripts/_verify-schedule-lib.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no imports from this project).
- Produces (from `src/lib/schedule.ts`, used by Task 3 and Task 4):
  - `isValidTime(value: string): boolean`
  - `getLocalDateString(date?: Date): string` — defaults to `new Date()`, returns `YYYY-MM-DD` in whatever timezone the calling environment's system clock is in.
  - `validateScheduleTimes(input: { workStart: string; workEnd: string; lunchStart?: string; lunchEnd?: string }): string | null` — returns a human-readable error string, or `null` if valid.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/_verify-schedule-lib.ts`:

```ts
import assert from "node:assert/strict";
import { getLocalDateString, validateScheduleTimes } from "../src/lib/schedule";

assert.equal(validateScheduleTimes({ workStart: "09:00", workEnd: "17:00" }), null);

assert.equal(
  validateScheduleTimes({
    workStart: "09:00",
    workEnd: "17:00",
    lunchStart: "12:30",
    lunchEnd: "13:00",
  }),
  null,
);

assert.ok(validateScheduleTimes({ workStart: "17:00", workEnd: "09:00" }));
assert.ok(validateScheduleTimes({ workStart: "9am", workEnd: "17:00" }));
assert.ok(
  validateScheduleTimes({ workStart: "09:00", workEnd: "17:00", lunchStart: "12:30" }),
);
assert.ok(
  validateScheduleTimes({
    workStart: "09:00",
    workEnd: "17:00",
    lunchStart: "08:00",
    lunchEnd: "08:30",
  }),
);
assert.ok(
  validateScheduleTimes({
    workStart: "09:00",
    workEnd: "17:00",
    lunchStart: "16:30",
    lunchEnd: "17:30",
  }),
);
assert.ok(
  validateScheduleTimes({
    workStart: "09:00",
    workEnd: "17:00",
    lunchStart: "13:00",
    lunchEnd: "12:30",
  }),
);

assert.equal(getLocalDateString(new Date(2026, 7, 4)), "2026-08-04");

console.log("OK: schedule lib verified");
```

- [ ] **Step 2: Run it to confirm it fails (module doesn't exist yet)**

Run: `npx --yes tsx scripts/_verify-schedule-lib.ts`
Expected: fails with a "Cannot find module '../src/lib/schedule'" style error.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/schedule.ts`:

```ts
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function validateScheduleTimes(input: {
  workStart: string;
  workEnd: string;
  lunchStart?: string;
  lunchEnd?: string;
}): string | null {
  const { workStart, workEnd, lunchStart, lunchEnd } = input;

  if (!isValidTime(workStart) || !isValidTime(workEnd)) {
    return "Work start and end must be valid times (HH:mm).";
  }
  if (toMinutes(workEnd) <= toMinutes(workStart)) {
    return "Work end must be after work start.";
  }

  const hasLunchStart = lunchStart !== undefined && lunchStart !== "";
  const hasLunchEnd = lunchEnd !== undefined && lunchEnd !== "";

  if (hasLunchStart !== hasLunchEnd) {
    return "Lunch start and end must both be set, or both left blank.";
  }

  if (hasLunchStart && hasLunchEnd) {
    if (!isValidTime(lunchStart!) || !isValidTime(lunchEnd!)) {
      return "Lunch start and end must be valid times (HH:mm).";
    }
    const start = toMinutes(workStart);
    const end = toMinutes(workEnd);
    const lStart = toMinutes(lunchStart!);
    const lEnd = toMinutes(lunchEnd!);
    if (lStart < start || lEnd > end || lStart >= lEnd) {
      return "Lunch window must fall within work hours.";
    }
  }

  return null;
}
```

- [ ] **Step 4: Run the verification script again to confirm it passes**

Run: `npx --yes tsx scripts/_verify-schedule-lib.ts`
Expected: prints `OK: schedule lib verified` and exits 0.

- [ ] **Step 5: Delete the temporary script**

Run: `rm scripts/_verify-schedule-lib.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule.ts
git commit -m "feat: add schedule validation and date helpers"
```

---

### Task 3: `/api/schedule` route (GET + PUT)

**Files:**
- Create: `src/app/api/schedule/route.ts`

**Interfaces:**
- Consumes: `getAuthUserFromRequest` (`src/lib/auth/request.ts`), `isFirebaseAdminConfigured` (`src/lib/firebase/admin.ts`), `prisma` (`src/lib/prisma.ts`), `prisma.daySchedule` (Task 1), `getLocalDateString`/`validateScheduleTimes` (Task 2).
- Produces:
  - `GET /api/schedule?date=YYYY-MM-DD` (Bearer token required, `date` optional → defaults to server's local date) → `200 { schedule: DaySchedule | null }` / `401 { error }` / `503 { error }` / `404 { error }`.
  - `PUT /api/schedule` (Bearer token required, JSON body `{ date?: string, workStart: string, workEnd: string, lunchStart?: string, lunchEnd?: string }`) → `200 { schedule }` / `400 { error }` / `401 { error }` / `503 { error }` / `404 { error }`.

- [ ] **Step 1: Implement the route**

Create `src/app/api/schedule/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { getLocalDateString, validateScheduleTimes } from "@/lib/schedule";

export async function GET(request: NextRequest) {
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

  const date = request.nextUrl.searchParams.get("date") ?? getLocalDateString();

  const schedule = await prisma.daySchedule.findUnique({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
  });

  return NextResponse.json({ schedule });
}

export async function PUT(request: NextRequest) {
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
    workStart?: string;
    workEnd?: string;
    lunchStart?: string;
    lunchEnd?: string;
  };

  if (typeof body.workStart !== "string" || typeof body.workEnd !== "string") {
    return NextResponse.json(
      { error: "workStart and workEnd are required." },
      { status: 400 },
    );
  }

  const validationError = validateScheduleTimes({
    workStart: body.workStart,
    workEnd: body.workEnd,
    lunchStart: body.lunchStart,
    lunchEnd: body.lunchEnd,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const date = body.date ?? getLocalDateString();

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

  return NextResponse.json({ schedule });
}
```

- [ ] **Step 2: Verify the auth guard with the dev server running**

Run: `npm run dev` (leave running in the background)

Then, in another terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/schedule
curl -s -o /dev/null -w "%{http_code}\n" -X PUT \
  -H "Content-Type: application/json" \
  -d '{"workStart":"09:00","workEnd":"17:00"}' \
  http://localhost:3000/api/schedule
```

Expected: both print `401` (no `Authorization` header). This confirms the guard order and that the route compiles/loads. The authenticated success path (a real Firebase ID token) is verified end-to-end in Task 4 via the browser, since minting a valid token requires a real signed-in session.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/schedule/route.ts
git commit -m "feat: add /api/schedule GET and PUT route"
```

---

### Task 4: Dashboard schedule form

**Files:**
- Create: `src/components/day-schedule-form.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ getIdToken, firebaseUser }` (`src/components/auth-provider.tsx`), `GET /api/schedule` / `PUT /api/schedule` (Task 3).
- Produces: `DayScheduleForm` component (default export removed — named export `DayScheduleForm`), rendered inside `DashboardPage`.

- [ ] **Step 1: Create the form component**

Create `src/components/day-schedule-form.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

type Schedule = {
  workStart: string;
  workEnd: string;
  lunchStart: string | null;
  lunchEnd: string | null;
};

export function DayScheduleForm() {
  const { firebaseUser, getIdToken } = useAuth();
  const [workStart, setWorkStart] = useState("");
  const [workEnd, setWorkEnd] = useState("");
  const [hasLunch, setHasLunch] = useState(false);
  const [lunchStart, setLunchStart] = useState("");
  const [lunchEnd, setLunchEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    let cancelled = false;

    async function load() {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/schedule", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { schedule: Schedule | null };
        if (data.schedule) {
          setWorkStart(data.schedule.workStart);
          setWorkEnd(data.schedule.workEnd);
          if (data.schedule.lunchStart && data.schedule.lunchEnd) {
            setHasLunch(true);
            setLunchStart(data.schedule.lunchStart);
            setLunchEnd(data.schedule.lunchEnd);
          }
        }
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, getIdToken]);

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (!workStart || !workEnd) {
      setError("Set both a work start and end time.");
      return;
    }
    if (workEnd <= workStart) {
      setError("Work end must be after work start.");
      return;
    }
    if (hasLunch) {
      if (!lunchStart || !lunchEnd) {
        setError("Set both a lunch start and end time, or turn lunch off.");
        return;
      }
      if (lunchStart < workStart || lunchEnd > workEnd || lunchStart >= lunchEnd) {
        setError("Lunch window must fall within work hours.");
        return;
      }
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

- [ ] **Step 2: Wire it into the dashboard, replacing the Day 2 placeholder card**

In `src/app/dashboard/page.tsx`, add the import:

```tsx
import { DayScheduleForm } from "@/components/day-schedule-form";
```

Replace this line:

```tsx
          <PlaceholderCard
            title="Today's schedule"
            detail="Work start / end + lunch — Day 2"
          />
```

with:

```tsx
          <DayScheduleForm />
```

Also update the header copy just above the grid — replace:

```tsx
          <p className="mt-2 text-stone-600">
            Day 1 dashboard. Tomorrow we add today&apos;s work hours and lunch
            window.
          </p>
```

with:

```tsx
          <p className="mt-2 text-stone-600">
            Set today&apos;s work hours below. Status toggles land tomorrow.
          </p>
```

- [ ] **Step 3: Manual end-to-end verification in the browser**

Run: `npm run dev` (if not already running from Task 3), open `http://localhost:3000/dashboard`, signed in as an existing test user.

Check each of the following:
1. First load with no schedule saved yet: Start/End are blank, no "Add lunch window" checked, no error shown.
2. Enter Start `09:00`, End `17:00`, click Save → button shows "Saving…" then "Saved." appears, no error.
3. Reload the page → Start/End are pre-filled with `09:00` / `17:00` (confirms `GET` + persistence).
4. Check "Add lunch window", enter `12:30`–`13:00`, click Save → "Saved." appears; reload → lunch checkbox is checked and pre-filled.
5. Set End to `08:00` (before Start `09:00`), click Save → inline error "Work end must be after work start." appears, no "Saved." shown, no request needed to reach the server (client-side check catches this).
6. Set a lunch window outside work hours (e.g., lunch `07:00`–`07:30`), click Save → inline error "Lunch window must fall within work hours."

This exercises the full `GET`/`PUT` round trip through a real authenticated session, which Task 3's curl checks couldn't reach.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/day-schedule-form.tsx src/app/dashboard/page.tsx
git commit -m "feat: add daily schedule form to dashboard"
```

---

## After this plan

Per `docs/BUILD-PLAN.md`, Day 2 also calls for a build-in-public post ("pain post — family interruptions") using the Day 2 template already drafted in `docs/BUILD-IN-PUBLIC-CALENDAR.md`. That's a content/compliance step, not a code task — check the `verchool-notification.md` "message sent" status (still unconfirmed as of this plan) before posting, then run the draft through `unslop` per that doc's checklist.

Day 3 (status toggle: `available` / `focused` / `in_meeting` / `off_clock`) is the next code task after this plan lands.
