# Day 4 — Public Share Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone with a `/s/[slug]` link see that user's work hours, lunch window, and current status — no login required — refreshing every 30 seconds.

**Architecture:** A new public (no-auth) API route `GET /api/s/[slug]` looks up a `User` by `slug` and their `DaySchedule` for a given date, returning only display-safe fields. A new client page `src/app/s/[slug]/page.tsx` fetches from it on mount and polls every 30s. Two small shared additions land in `src/lib/schedule.ts` first: a hoisted `STATUS_LABELS` map (currently duplicated only in `StatusPanel`, now shared) and a new `isStatusUntilStale` helper for the "don't show an already-passed until time" display rule.

**Tech Stack:** Next.js 16 App Router (first dynamic route segment in this project — `params` is a `Promise<{ slug: string }>` per this project's Next.js version, must be `await`ed), Prisma 6/Postgres, Tailwind. No test framework in this project (documented, deliberate).

## Global Constraints

- This is the **first route in the project with no auth guard** — deliberately public. Do not add `isFirebaseAdminConfigured`/`getAuthUserFromRequest` checks to `/api/s/[slug]`.
- Never expose `email`, `firebaseUid`, or `id` in the public API response — only `displayName`, `hasSchedule`, and (when true) the schedule's display fields.
- Dates are plain `YYYY-MM-DD` strings computed **client-side** via `getLocalDateString()` from `src/lib/schedule.ts` — never rely on the server's clock for "today" (established in Day 2/3).
- Next.js 16 dynamic route params are async: `{ params }: { params: Promise<{ slug: string }> }` in the route handler, `await params` before use. In the client page, use the `useParams()` hook from `next/navigation` instead (this codebase already imports from `next/navigation` elsewhere — `useRouter`, `usePathname` in `dashboard-shell.tsx`).
- UI follows the existing Tailwind style: stone-toned text, `rounded-2xl` cards, teal accents — but this page has **no header/nav chrome** (no `DashboardShell`), per the spec's "kitchen tablet" framing.
- Status must never be shown by color alone — icon/label + color together (established convention, this project's own accessibility backlog already flags color-only status).

---

### Task 1: Shared status-label map and stale-until helper

**Files:**
- Modify: `src/lib/schedule.ts`
- Modify: `src/components/status-panel.tsx` (remove its local `STATUS_LABELS`, import the shared one)
- Create (temporary, deleted at end of task): `scripts/_verify-share-helpers.ts`

**Interfaces:**
- Consumes: `SCHEDULE_STATUSES`, `ScheduleStatusValue`, `isValidTime` (all already in `src/lib/schedule.ts`).
- Produces (from `src/lib/schedule.ts`, used by Task 3):
  - `STATUS_LABELS: Record<ScheduleStatusValue, string>` — `{ available: "Available", focused: "Focused", in_meeting: "In a meeting", off_clock: "Off the clock" }` (byte-identical to `StatusPanel`'s current local copy, just relocated).
  - `isStatusUntilStale(statusUntil: string, now?: Date): boolean` — `true` if `statusUntil` is a valid `HH:mm` earlier than `now`'s time-of-day; `false` for malformed input (fail-safe: an unparseable value is treated as not-stale, so it still displays rather than silently vanishing) and for a value equal to or later than `now`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/_verify-share-helpers.ts`:

```ts
import assert from "node:assert/strict";
import {
  SCHEDULE_STATUSES,
  STATUS_LABELS,
  isStatusUntilStale,
} from "../src/lib/schedule";

for (const status of SCHEDULE_STATUSES) {
  assert.ok(STATUS_LABELS[status], `missing label for ${status}`);
}
assert.equal(Object.keys(STATUS_LABELS).length, SCHEDULE_STATUSES.length);
assert.equal(STATUS_LABELS.available, "Available");
assert.equal(STATUS_LABELS.focused, "Focused");
assert.equal(STATUS_LABELS.in_meeting, "In a meeting");
assert.equal(STATUS_LABELS.off_clock, "Off the clock");

const now = new Date(2026, 0, 1, 14, 0);
assert.equal(isStatusUntilStale("15:00", now), false);
assert.equal(isStatusUntilStale("14:00", now), false);
assert.equal(isStatusUntilStale("13:59", now), true);
assert.equal(isStatusUntilStale("09:00", now), true);
assert.equal(isStatusUntilStale("not-a-time", now), false);

console.log("OK: share-page helpers verified");
```

- [ ] **Step 2: Run it to confirm it fails (exports don't exist yet)**

Run: `npx --yes tsx scripts/_verify-share-helpers.ts`
Expected: fails — `STATUS_LABELS`/`isStatusUntilStale` are not exported from `../src/lib/schedule`.

- [ ] **Step 3: Add the exports to `src/lib/schedule.ts`**

Add after the existing `export type Schedule = {...}` block at the end of the file:

```ts
export const STATUS_LABELS: Record<ScheduleStatusValue, string> = {
  available: "Available",
  focused: "Focused",
  in_meeting: "In a meeting",
  off_clock: "Off the clock",
};

export function isStatusUntilStale(
  statusUntil: string,
  now: Date = new Date(),
): boolean {
  if (!isValidTime(statusUntil)) return false;
  const [hours, minutes] = statusUntil.split(":").map(Number);
  const untilMinutes = hours * 60 + minutes;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return untilMinutes < nowMinutes;
}
```

- [ ] **Step 4: Remove the duplicate label map from `StatusPanel`**

In `src/components/status-panel.tsx`, change the import block:

```ts
import {
  SCHEDULE_STATUSES,
  getLocalDateString,
  validateStatusUpdate,
  type Schedule,
  type ScheduleStatusValue,
} from "@/lib/schedule";
```

to:

```ts
import {
  SCHEDULE_STATUSES,
  STATUS_LABELS,
  getLocalDateString,
  validateStatusUpdate,
  type Schedule,
} from "@/lib/schedule";
```

(`ScheduleStatusValue` is dropped from the import — it was only used as the local `STATUS_LABELS`'s type annotation, which is being deleted next; confirm nothing else in the file references `ScheduleStatusValue` before removing it from the import.)

Then delete this block entirely (it's now redundant with the shared export):

```ts
const STATUS_LABELS: Record<ScheduleStatusValue, string> = {
  available: "Available",
  focused: "Focused",
  in_meeting: "In a meeting",
  off_clock: "Off the clock",
};
```

- [ ] **Step 5: Run the verification script again to confirm it passes**

Run: `npx --yes tsx scripts/_verify-share-helpers.ts`
Expected: prints `OK: share-page helpers verified` and exits 0.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Delete the temporary script**

Run: `rm scripts/_verify-share-helpers.ts`

- [ ] **Step 8: Commit**

```bash
git add src/lib/schedule.ts src/components/status-panel.tsx
git commit -m "refactor: hoist STATUS_LABELS and add isStatusUntilStale to schedule.ts"
```

---

### Task 2: Public `/api/s/[slug]` route

**Files:**
- Create: `src/app/api/s/[slug]/route.ts`
- Create (temporary, deleted at end of task): `scripts/_verify-share-route-seed.mjs`
- Create (temporary, deleted at end of task): `scripts/_verify-share-route-cleanup.mjs`

**Interfaces:**
- Consumes: `prisma` (`src/lib/prisma.ts`), `getLocalDateString` (`src/lib/schedule.ts`), `prisma.user.findUnique({ where: { slug } })`, `prisma.daySchedule.findUnique({ where: { userId_date: {...} } })`.
- Produces: `GET /api/s/[slug]?date=YYYY-MM-DD` (no auth required) →
  `404 { error: "Not found" }` (unknown slug) /
  `200 { displayName: string | null, hasSchedule: false }` (user exists, no schedule for that date) /
  `200 { displayName: string | null, hasSchedule: true, workStart: string, workEnd: string, lunchStart: string | null, lunchEnd: string | null, status: ScheduleStatusValue | null, statusUntil: string | null, statusMessage: string | null }` /
  `400 { error: "date must be in YYYY-MM-DD format." }` on a malformed `date` param.

- [ ] **Step 1: Implement the route**

Create `src/app/api/s/[slug]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/schedule";

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await prisma.user.findUnique({
    where: { slug },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  if (dateParam !== null && !DATE_RE.test(dateParam)) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format." },
      { status: 400 },
    );
  }
  const date = dateParam ?? getLocalDateString();

  const schedule = await prisma.daySchedule.findUnique({
    where: { userId_date: { userId: user.id, date: new Date(date) } },
  });

  if (!schedule) {
    return NextResponse.json({
      displayName: user.displayName,
      hasSchedule: false,
    });
  }

  return NextResponse.json({
    displayName: user.displayName,
    hasSchedule: true,
    workStart: schedule.workStart,
    workEnd: schedule.workEnd,
    lunchStart: schedule.lunchStart,
    lunchEnd: schedule.lunchEnd,
    status: schedule.status,
    statusUntil: schedule.statusUntil,
    statusMessage: schedule.statusMessage,
  });
}
```

- [ ] **Step 2: Write the seed script**

This route needs no auth token, so — unlike every prior route in this project — its full happy path is genuinely curl-testable end to end. Create `scripts/_verify-share-route-seed.mjs`:

```js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      firebaseUid: `verify-share-has-schedule-${Date.now()}`,
      email: `verify-share-has-schedule-${Date.now()}@example.com`,
      displayName: "Verify Has Schedule",
      slug: "verify-share-has-schedule",
      daySchedules: {
        create: {
          date: new Date("2026-08-08"),
          workStart: "09:00",
          workEnd: "17:00",
          lunchStart: "12:30",
          lunchEnd: "13:00",
          status: "focused",
          statusUntil: "15:00",
          statusMessage: "Deep work, back after 3",
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      firebaseUid: `verify-share-no-schedule-${Date.now()}`,
      email: `verify-share-no-schedule-${Date.now()}@example.com`,
      displayName: "Verify No Schedule",
      slug: "verify-share-no-schedule",
    },
  });

  console.log("OK: seeded verify-share-has-schedule and verify-share-no-schedule");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3: Write the cleanup script**

Create `scripts/_verify-share-route-cleanup.mjs`:

```js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany({
    where: {
      slug: { in: ["verify-share-has-schedule", "verify-share-no-schedule"] },
    },
  });
  console.log("OK: cleaned up verify-share test users");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Seed, start the dev server, and run the curl checks**

Run: `node --env-file=.env.local scripts/_verify-share-route-seed.mjs`
Expected: `OK: seeded verify-share-has-schedule and verify-share-no-schedule`

Run: `npm run dev` in the background.

```bash
curl -s http://localhost:3000/api/s/does-not-exist-xyz
curl -s "http://localhost:3000/api/s/verify-share-has-schedule?date=2026-08-08"
curl -s http://localhost:3000/api/s/verify-share-no-schedule
```

Expected, respectively:
- `{"error":"Not found"}`
- `{"displayName":"Verify Has Schedule","hasSchedule":true,"workStart":"09:00","workEnd":"17:00","lunchStart":"12:30","lunchEnd":"13:00","status":"focused","statusUntil":"15:00","statusMessage":"Deep work, back after 3"}`
- `{"displayName":"Verify No Schedule","hasSchedule":false}`

Also confirm no private fields (`email`, `firebaseUid`, `id`) appear anywhere in the output.

- [ ] **Step 5: Clean up**

Run: `node --env-file=.env.local scripts/_verify-share-route-cleanup.mjs`
Expected: `OK: cleaned up verify-share test users`

Stop the dev server. Delete both temporary scripts:

```bash
rm scripts/_verify-share-route-seed.mjs scripts/_verify-share-route-cleanup.mjs
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/s/[slug]/route.ts
git commit -m "feat: add public /api/s/[slug] route"
```

---

### Task 3: Public share page UI

**Files:**
- Create: `src/app/s/[slug]/page.tsx`

**Interfaces:**
- Consumes: `useParams<{ slug: string }>()` (`next/navigation`), `GET /api/s/[slug]` (Task 2), `STATUS_LABELS`, `isStatusUntilStale` (Task 1, from `src/lib/schedule.ts`).
- Produces: default-exported page component at route `/s/[slug]`.

- [ ] **Step 1: Implement the page**

Create `src/app/s/[slug]/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Verify the route compiles and renders**

Run: `npm run dev` (if not already running).

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/s/anything-at-all
```

Expected: `200` (the page itself always renders — a client component's initial server-rendered pass shows the "Loading…" state regardless of whether the slug is valid; the 404-vs-found distinction only resolves client-side after the effect's fetch completes, which curl cannot observe). This check only confirms the route compiles and returns a page shell without a build/runtime error — it is not a substitute for the manual browser check below.

Stop the dev server when done.

- [ ] **Step 4: Manual browser verification (cannot be performed in this environment)**

State plainly in your report that this was not performed live — no real browser is available in this environment to observe client-side rendering after data loads. The full checklist a human needs to run:
1. Visit `/s/<a real slug with today's schedule set>` — confirm name, status, until (if not stale), message, work hours, and lunch window (if set) all render correctly.
2. Change status on the dashboard in another tab; within 30s, confirm the share page updates without a manual reload.
3. Visit `/s/<a slug that doesn't exist>` — confirm "This link isn't valid."
4. Visit the share page for a user who exists but hasn't set today's schedule — confirm "Hasn't set up today's schedule yet."
5. Set a status with an `until` time in the past (e.g. edit the dev database directly, or wait for a real one to lapse) — confirm the "until HH:mm" line is hidden but the status itself still shows.

- [ ] **Step 5: Commit**

```bash
git add src/app/s/[slug]/page.tsx
git commit -m "feat: add public share page UI"
```

---

## After this plan

Per `docs/BUILD-PLAN.md`, Day 4 also calls for making the GitHub repo public (it's currently... check current visibility, this wasn't verified when the repo was created) and a build-in-public post ("share page on phone mockup"). Both are follow-up actions, not code tasks.

Day 5 (share link copy button + QR code) is the next code task after this plan lands — it only needs the `/s/[slug]` URL this plan produces, no new backend work.
