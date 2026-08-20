# Day 10 — Stripe + Pro Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working $6/mo Stripe subscription that gates two Pro features (custom footer message on the public share page, dashboard shutdown streak) behind `User.isPro`, with hosted Stripe Checkout for signup and the Stripe Billing Portal for cancellation.

**Architecture:** Stripe Checkout (hosted, redirect-based) creates the subscription; a signature-verified webhook route is the *only* writer of `isPro`/`stripeCustomerId` (never trust the client-side redirect alone, since a user can land on the success URL without payment actually completing — only the webhook confirms it). The shutdown streak is computed on read from existing `DaySchedule.shutdownAt` rows, not stored, to avoid a counter that can drift from the underlying data.

**Tech Stack:** Next.js 16 App Router route handlers, Prisma 6 + Neon Postgres, `stripe` npm package (server SDK only — no Stripe.js, since both Checkout and the Billing Portal are full-page redirects).

**Spec:** `docs/superpowers/specs/2026-08-20-day10-stripe-pro-tier-design.md`

## Global Constraints

- Test mode only — `STRIPE_SECRET_KEY`/`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `.env.local` are already `sk_test_`/`pk_test_`. Never add live-mode handling in this pass.
- `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` are already set in `.env.local` — routes read them via `process.env`, never hardcode.
- Server-side gating only — a client that never re-fetches its profile must still be blocked by the API, not just hidden in the UI.
- "What day is it" logic must use the client-supplied `?date=YYYY-MM-DD` query param (defaulting to the server's `getLocalDateString()` only when the param is absent) — the same convention `GET /api/schedule` already uses. Never call `new Date()` server-side to decide the calendar date for streak purposes.
- No test framework exists in this project (confirmed: no `*.test.ts` files, no jest/vitest in `package.json`). Verification per task is: `npx tsc --noEmit`, `npx eslint src`, and a manual check (`psql`/`curl`/browser) — matching how every prior day (2 through 9) in this project was verified.
- This project uses `prisma db push` (`npm run db:push`), not `prisma migrate` — there is no `prisma/migrations/` directory. Schema changes apply via `db push`.

---

### Task 1: Schema — `isPro`, `stripeCustomerId`, `footerMessage`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `User.isPro: boolean`, `User.stripeCustomerId: string | null`, `User.footerMessage: string | null` — every later task reads/writes these three fields on the Prisma `User` model.

- [ ] **Step 1: Add the three fields to the `User` model**

In `prisma/schema.prisma`, the `User` model currently ends with:
```prisma
model User {
  id                String   @id @default(cuid())
  firebaseUid       String   @unique @map("firebase_uid")
  email             String   @unique
  displayName       String?  @map("display_name")
  slug              String?  @unique
  defaultWorkStart  String?  @map("default_work_start")
  defaultWorkEnd    String?  @map("default_work_end")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  daySchedules DaySchedule[]

  @@map("users")
}
```

Change it to:
```prisma
model User {
  id                String   @id @default(cuid())
  firebaseUid       String   @unique @map("firebase_uid")
  email             String   @unique
  displayName       String?  @map("display_name")
  slug              String?  @unique
  defaultWorkStart  String?  @map("default_work_start")
  defaultWorkEnd    String?  @map("default_work_end")
  stripeCustomerId  String?  @unique @map("stripe_customer_id")
  isPro             Boolean  @default(false) @map("is_pro")
  footerMessage     String?  @map("footer_message")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  daySchedules DaySchedule[]

  @@map("users")
}
```

- [ ] **Step 2: Push the schema to Neon**

Run: `npm run db:push`
Expected: Prisma reports the new columns added (`stripe_customer_id`, `is_pro`, `footer_message`) and regenerates the client. If it prompts about data loss, there is none here (all three are additive/nullable-or-defaulted) — confirm.

- [ ] **Step 3: Verify the columns exist**

Run: `psql "$DATABASE_URL" -c "\d users"` (reads `DATABASE_URL` from your shell env — if unset, run `export $(grep DATABASE_URL .env.local | xargs)` first)
Expected: `stripe_customer_id`, `is_pro`, `footer_message` columns listed.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the generated Prisma client now has the new fields; nothing references them yet).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add isPro, stripeCustomerId, footerMessage to User"
```

---

### Task 2: Stripe client + `POST /api/stripe/checkout`

**Files:**
- Create: `src/lib/stripe.ts`
- Create: `src/app/api/stripe/checkout/route.ts`
- Modify: `package.json` (new dependency)

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`, `getAuthUserFromRequest` from `@/lib/auth/request`, `isFirebaseAdminConfigured` from `@/lib/firebase/admin` — same three imports every other authed route in this project uses (see `src/app/api/profile/route.ts`).
- Produces: `stripe` (a configured `Stripe` client instance) exported from `src/lib/stripe.ts` — Tasks 3 and 4 import this same instance, never construct their own `new Stripe(...)`.

- [ ] **Step 1: Install the Stripe SDK**

Run: `npm install stripe`
Expected: `stripe` (^22.x) added to `dependencies` in `package.json`.

- [ ] **Step 2: Create the Stripe client singleton**

Create `src/lib/stripe.ts`:
```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
```

No `apiVersion` is passed — the installed SDK defaults to its own pinned API version, so this doesn't need updating when Stripe ships new versions. This mirrors `src/lib/prisma.ts`'s plain-singleton-export shape (no `globalThis` caching needed here since the Stripe client holds no persistent connection the way Prisma's does).

- [ ] **Step 3: Create the checkout route**

Create `src/app/api/stripe/checkout/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
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

  if (user.isPro) {
    return NextResponse.json({ error: "Already Pro." }, { status: 400 });
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price is not configured." },
      { status: 503 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: decoded.uid,
    ...(user.stripeCustomerId
      ? { customer: user.stripeCustomerId }
      : { customer_email: user.email }),
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/dashboard`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not create checkout session." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors.

- [ ] **Step 5: Manual verification**

With the dev server running and `stripe listen --forward-to localhost:3000/api/stripe/webhook` running in another terminal, get a fresh ID token (browser console: `await firebase.auth().currentUser.getIdToken()` while logged into the app) and run:
```bash
curl -s -X POST http://localhost:3000/api/stripe/checkout \
  -H "Authorization: Bearer <paste token>" | python3 -m json.tool
```
Expected: `{"url": "https://checkout.stripe.com/..."}`. Paste that URL into a browser — it should load a real Stripe Checkout page for $6.00/month.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/stripe.ts src/app/api/stripe/checkout/route.ts
git commit -m "feat: add Stripe client and checkout session route"
```

---

### Task 3: `POST /api/stripe/webhook`

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `stripe` from `@/lib/stripe` (Task 2), `prisma` from `@/lib/prisma`.
- Produces: nothing consumed by later tasks — this route is a terminal event handler. Its effect (`isPro`/`stripeCustomerId` writes) is what Task 7's dashboard UI observes via `GET /api/profile`.

This route is the **only** place `isPro` gets set to `true` — the checkout success redirect (`?upgraded=1`) only triggers a profile refetch, it never sets `isPro` itself, because a user can reach the success URL without Stripe having actually confirmed payment yet.

- [ ] **Step 1: Create the webhook route**

Create `src/app/api/stripe/webhook/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const firebaseUid = session.client_reference_id;
    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    if (firebaseUid && customerId) {
      await prisma.user.update({
        where: { firebaseUid },
        data: { isPro: true, stripeCustomerId: customerId },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : null;

    if (customerId) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { isPro: false },
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

`prisma.user.updateMany` (not `update`) is used for the deletion path because `stripeCustomerId` lookup has no guaranteed-existing row the way `firebaseUid` does inside a webhook that could in principle fire for a customer whose user row was deleted — `updateMany` is a no-op instead of throwing if zero rows match, which is the safer failure mode for a webhook handler (Stripe retries on non-2xx, and an unhandled throw here would turn into pointless retries for a case that will never resolve).

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors.

- [ ] **Step 3: Manual verification — signature rejection**

Run: `curl -s -X POST http://localhost:3000/api/stripe/webhook -d '{}' -o /dev/null -w "%{http_code}\n"`
Expected: `503` (no `stripe-signature` header sent, so it hits the "not configured" branch first) — confirms the route doesn't blindly accept unsigned bodies. Then with a fake signature header:
```bash
curl -s -X POST http://localhost:3000/api/stripe/webhook -d '{}' -H "stripe-signature: t=1,v1=fake" -o /dev/null -w "%{http_code}\n"
```
Expected: `400` (signature verification fails).

- [ ] **Step 4: Manual verification — real event via Stripe CLI**

With `stripe listen --forward-to localhost:3000/api/stripe/webhook` running, in another terminal:
```bash
stripe trigger checkout.session.completed
```
Expected: the `stripe listen` terminal shows the event forwarded with a `200` response from your dev server. (This trigger fires with Stripe's own test fixture data, not your real Task 2 checkout session — `client_reference_id` on the fixture won't match a real `firebaseUid`, so no DB row will actually update. This step is checking wiring — status 200, signature verified, no server error — not the DB write. Task 5's end-to-end flow is what verifies the actual `isPro` write.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: add signature-verified Stripe webhook handler"
```

---

### Task 4: `POST /api/stripe/portal`

**Files:**
- Create: `src/app/api/stripe/portal/route.ts`

**Interfaces:**
- Consumes: `stripe` from `@/lib/stripe`, `prisma` from `@/lib/prisma`, `getAuthUserFromRequest`, `isFirebaseAdminConfigured`.
- Produces: nothing consumed by later tasks besides Task 7's "Manage subscription" button, which just needs to know this endpoint returns `{ url: string }` on success.

- [ ] **Step 1: Create the portal route**

Create `src/app/api/stripe/portal/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
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

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No subscription to manage." },
      { status: 400 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors.

- [ ] **Step 3: Manual verification**

```bash
curl -s -X POST http://localhost:3000/api/stripe/portal -H "Authorization: Bearer <fresh token>" | python3 -m json.tool
```
Expected (for a non-Pro test user, before Task 2/3's checkout has actually completed): `{"error": "No subscription to manage."}` with a 400. This is the correct result at this point in the plan — full end-to-end (real subscription → portal works) gets verified in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/portal/route.ts
git commit -m "feat: add Stripe billing portal route"
```

---

### Task 5: Streak calculation + `GET /api/streak`

**Files:**
- Create: `src/lib/streak.ts`
- Create: `src/app/api/streak/route.ts`

**Interfaces:**
- Produces: `computeStreak(shutdownDates: string[], today: string): number` exported from `src/lib/streak.ts` — pure function, no I/O, so it's cheap to reason about independent of the route. `shutdownDates` are `YYYY-MM-DD` strings for every day that has `shutdownAt` set, already sorted descending. `today` is the caller's local date string (same shape as `getLocalDateString()`'s output).
- `GET /api/streak` returns `{ streak: number }`.

- [ ] **Step 1: Write the streak calculation as a pure function**

Create `src/lib/streak.ts`:
```ts
function subtractDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * shutdownDates: YYYY-MM-DD strings with shutdownAt set, sorted descending.
 * today: the caller's local YYYY-MM-DD date.
 */
export function computeStreak(shutdownDates: string[], today: string): number {
  if (shutdownDates.length === 0) return 0;

  const mostRecent = shutdownDates[0];
  const yesterday = subtractDays(today, 1);
  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0;
  }

  const set = new Set(shutdownDates);
  let streak = 0;
  let cursor = mostRecent;
  while (set.has(cursor)) {
    streak += 1;
    cursor = subtractDays(cursor, 1);
  }
  return streak;
}
```

- [ ] **Step 2: Create the streak route**

Create `src/app/api/streak/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth/request";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/schedule";
import { computeStreak } from "@/lib/streak";

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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

  const dateParam = request.nextUrl.searchParams.get("date");
  if (dateParam !== null && !DATE_RE.test(dateParam)) {
    return NextResponse.json(
      { error: "date must be in YYYY-MM-DD format." },
      { status: 400 },
    );
  }
  const today = dateParam ?? getLocalDateString();

  const rows = await prisma.daySchedule.findMany({
    where: { userId: user.id, shutdownAt: { not: null } },
    orderBy: { date: "desc" },
    take: 400,
    select: { date: true },
  });

  const shutdownDates = rows.map((row) => getLocalDateString(row.date));
  const streak = computeStreak(shutdownDates, today);

  return NextResponse.json({ streak });
}
```

`getLocalDateString(row.date)` converts each row's stored `@db.Date` value back to a plain `YYYY-MM-DD` string using the same formatter the rest of the app uses, keeping the string shape consistent with `today`.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors.

- [ ] **Step 4: Verify `computeStreak`'s logic directly**

Create a temporary file `verify-streak.ts` in the project root:
```ts
import { computeStreak } from "./src/lib/streak";

const cases: [string[], string, number][] = [
  [[], "2026-08-20", 0],
  [["2026-08-20", "2026-08-19", "2026-08-18"], "2026-08-20", 3],
  [["2026-08-19", "2026-08-18"], "2026-08-20", 2],
  [["2026-08-17"], "2026-08-20", 0],
  [["2026-08-20", "2026-08-18"], "2026-08-20", 1],
];

for (const [dates, today, expected] of cases) {
  const actual = computeStreak(dates, today);
  const pass = actual === expected;
  console.log(`${pass ? "PASS" : "FAIL"}: computeStreak(${JSON.stringify(dates)}, "${today}") = ${actual} (expected ${expected})`);
}
```

Run: `npx tsx verify-streak.ts`
Expected: all five lines print `PASS`. The five cases cover: no history (0), today-inclusive unbroken streak (3), streak ending yesterday with today not-yet-shut-down (2, the mid-day-grace behavior from the spec), a broken streak too old to count (0), and a one-day gap that truncates the walk-back after counting the most recent day (1).

Delete the temp file once it passes: `rm verify-streak.ts`

- [ ] **Step 5: Manual verification via the route**

With a fresh ID token, hit `GET /api/streak` for a user with no `shutdownAt` rows yet:
```bash
curl -s "http://localhost:3000/api/streak" -H "Authorization: Bearer <token>" | python3 -m json.tool
```
Expected: `{"streak": 0}`. Then complete the shutdown wizard once today (via the dashboard UI, which sets `shutdownAt` on today's row) and re-run the same curl.
Expected: `{"streak": 1}`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/streak.ts src/app/api/streak/route.ts
git commit -m "feat: add shutdown streak calculation and endpoint"
```

---

### Task 6: Server-side `footerMessage` gating

**Files:**
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/api/s/[slug]/route.ts`

**Interfaces:**
- Consumes: `User.footerMessage`, `User.isPro` (Task 1).
- Produces: `PATCH /api/profile` accepts `footerMessage?: string` in its body. `GET /api/s/[slug]` response gains `footerMessage: string | null`.

- [ ] **Step 1: Extend `PATCH /api/profile`'s body type and add gating**

In `src/app/api/profile/route.ts`, the `PATCH` handler currently starts its body parsing at:
```ts
  const body = (await request.json()) as {
    displayName?: string;
    slug?: string;
    defaultWorkStart?: string;
    defaultWorkEnd?: string;
  };

  const data: {
    displayName?: string;
    slug?: string;
    defaultWorkStart?: string;
    defaultWorkEnd?: string;
  } = {};
```

Change both type literals to add `footerMessage?: string`:
```ts
  const body = (await request.json()) as {
    displayName?: string;
    slug?: string;
    defaultWorkStart?: string;
    defaultWorkEnd?: string;
    footerMessage?: string;
  };

  const data: {
    displayName?: string;
    slug?: string;
    defaultWorkStart?: string;
    defaultWorkEnd?: string;
    footerMessage?: string | null;
  } = {};
```

Then, right before the existing `if (Object.keys(data).length === 0)` check near the end of the handler, insert:
```ts
  if (typeof body.footerMessage === "string") {
    const trimmed = body.footerMessage.trim();
    if (trimmed.length > 0) {
      const dbUser = await prisma.user.findUnique({
        where: { firebaseUid: decoded.uid },
        select: { isPro: true },
      });
      if (!dbUser?.isPro) {
        return NextResponse.json({ error: "Pro required." }, { status: 403 });
      }
      if (trimmed.length > 140) {
        return NextResponse.json(
          { error: "Footer message must be 140 characters or fewer." },
          { status: 400 },
        );
      }
      data.footerMessage = trimmed;
    } else {
      data.footerMessage = null;
    }
  }
```

This allows clearing the message (`footerMessage: ""` → stored `null`) regardless of Pro status — a downgraded user can still remove stale text — but requires Pro to set a non-empty one. A fresh `prisma.user.findUnique` for `isPro` is used here rather than reusing a variable, because this handler doesn't currently fetch the user record before the update (`prisma.user.update` at the bottom is the first and only read/write); adding one targeted `select: { isPro: true }` lookup is cheaper than restructuring the whole handler to fetch the full user upfront.

- [ ] **Step 2: Include `footerMessage` in the public share response, gated on `isPro`**

In `src/app/api/s/[slug]/route.ts`, the final `return NextResponse.json({...})` for the has-schedule case currently ends with `statusMessage: schedule.statusMessage,`. Change the full return block from:
```ts
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
```
to:
```ts
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
    footerMessage: user.isPro ? user.footerMessage : null,
  });
```

Also update the no-schedule-yet branch just above it — currently:
```ts
  if (!schedule) {
    return NextResponse.json({
      displayName: user.displayName,
      hasSchedule: false,
    });
  }
```
to:
```ts
  if (!schedule) {
    return NextResponse.json({
      displayName: user.displayName,
      hasSchedule: false,
      footerMessage: user.isPro ? user.footerMessage : null,
    });
  }
```
The footer message is about the household/person, not the day's schedule, so it should show even before today's schedule is set.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors.

- [ ] **Step 4: Manual verification**

As a non-Pro test user, try setting a footer message:
```bash
curl -s -X PATCH http://localhost:3000/api/profile \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"footerMessage": "back after 6"}' | python3 -m json.tool
```
Expected: `{"error": "Pro required."}`, status 403. After manually flipping that user's `isPro` to `true` via `psql "$DATABASE_URL" -c "update users set is_pro = true where email = '<your email>';"` (temporary, for this test only — Task 3's webhook is the real path), retry the same curl — expected: `200` with the updated user. Then hit `curl -s http://localhost:3000/api/s/<your-slug> | python3 -m json.tool` and confirm `footerMessage` appears. Set `is_pro` back to `false` via the same `psql` command afterward and re-check that `footerMessage` in the `/api/s/<slug>` response goes back to `null` even though the stored value is still there (proves the gate is on the read path, not just the write path).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/profile/route.ts "src/app/api/s/[slug]/route.ts"
git commit -m "feat: gate footer message read/write behind isPro"
```

---

### Task 7: Dashboard client — upgrade CTA, streak card, manage subscription

**Files:**
- Modify: `src/components/auth-provider.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `GET /api/streak` (Task 5), `POST /api/stripe/checkout` (Task 2), `POST /api/stripe/portal` (Task 4).
- Produces: `AppUser.isPro: boolean`, `AppUser.footerMessage: string | null` — Task 8's setup-page edit reads `appUser.isPro` from this same type.

- [ ] **Step 1: Add the new fields to the `AppUser` type**

In `src/components/auth-provider.tsx`, change:
```ts
export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  slug: string | null;
  defaultWorkStart: string | null;
  defaultWorkEnd: string | null;
};
```
to:
```ts
export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  slug: string | null;
  defaultWorkStart: string | null;
  defaultWorkEnd: string | null;
  isPro: boolean;
  footerMessage: string | null;
};
```
No other change is needed in this file — `GET /api/profile` and `POST /api/auth/sync` both already return the full Prisma `User` record, so these two new fields arrive automatically once Task 1's migration has landed.

- [ ] **Step 2: Add the upgrade/streak/manage UI to the dashboard**

In `src/app/dashboard/page.tsx`, add three new pieces of state right after the existing `const [showShutdownWizard, setShowShutdownWizard] = useState(false);` line:
```tsx
  const [streak, setStreak] = useState<number | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
```

Add this `useEffect` right after the existing `fetchSchedule`-calling `useEffect` block (the one with the `load()` wrapper):
```tsx
  useEffect(() => {
    if (!appUser?.isPro || !firebaseUser) return;
    let cancelled = false;
    async function loadStreak() {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch(`/api/streak?date=${getLocalDateString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!cancelled && res.ok) {
        const data = (await res.json()) as { streak: number };
        setStreak(data.streak);
      }
    }
    loadStreak();
    return () => {
      cancelled = true;
    };
  }, [appUser?.isPro, firebaseUser, getIdToken]);
```

Add this `useEffect` for the `?upgraded=1` post-checkout refresh, also after the existing effects:
```tsx
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "1") {
      refreshProfile();
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [refreshProfile]);
```

Add these two handlers above the `return` statement, alongside where `shareHref` is computed:
```tsx
  async function startCheckout() {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Checkout failed");
      setBillingLoading(false);
    }
  }

  async function openPortal() {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not open billing portal");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Could not open billing portal");
      setBillingLoading(false);
    }
  }
```

Finally, add the Pro card into the existing `<div className="grid gap-4 sm:grid-cols-2">` grid, right after the closing of the "Shutdown ritual" `<button>` block and before that grid `</div>` closes:
```tsx
            {appUser?.isPro ? (
              <div className="rounded-card glass p-5">
                <h2 className="font-display font-medium text-ink">
                  Shutdown streak
                </h2>
                <p className="mt-2 text-2xl font-semibold text-ink">
                  {streak === null ? "…" : streak}{" "}
                  <span className="text-sm font-normal text-ink-2">
                    {streak === 1 ? "day" : "days"}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={billingLoading}
                  className="focus-ring mt-3 text-sm font-medium text-accent underline decoration-2 underline-offset-2 hover:text-ink disabled:opacity-60"
                >
                  Manage subscription
                </button>
              </div>
            ) : (
              <div className="rounded-card glass p-5">
                <h2 className="font-display font-medium text-ink">
                  Upgrade to Pro
                </h2>
                <p className="mt-2 text-sm text-ink-2">
                  $6/mo — custom footer message + shutdown streak.
                </p>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={billingLoading}
                  className="focus-ring mt-3 rounded-input bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.02] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {billingLoading ? "Redirecting…" : "Upgrade — $6/mo"}
                </button>
              </div>
            )}
            {billingError && (
              <p className="text-sm text-danger sm:col-span-2">{billingError}</p>
            )}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server and `stripe listen`. Log into the dashboard as a non-Pro test user — confirm the "Upgrade to Pro" card renders and clicking it redirects to a real Stripe Checkout page. Complete a test payment (card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP). Confirm you land back on `/dashboard?upgraded=1`, the URL cleans itself up to `/dashboard`, and the card switches to the streak view showing "0 days" (no shutdown yet today) with a working "Manage subscription" link that opens the real Stripe Billing Portal.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth-provider.tsx src/app/dashboard/page.tsx
git commit -m "feat: add Pro upgrade CTA, streak card, and billing portal link to dashboard"
```

---

### Task 8: Footer message client UI — setup page input + share page render

**Files:**
- Modify: `src/app/setup/page.tsx`
- Modify: `src/app/s/[slug]/page.tsx`

**Interfaces:**
- Consumes: `AppUser.isPro`, `AppUser.footerMessage` (Task 7), `PATCH /api/profile` with `footerMessage` (Task 6), `GET /api/s/[slug]` with `footerMessage` (Task 6).

- [ ] **Step 1: Add the footer message field to the setup page**

In `src/app/setup/page.tsx`, add a new state variable next to the existing `displayName`/`slug` state (right after `const [slug, setSlug] = useState("");`):
```tsx
  const [footerMessage, setFooterMessage] = useState("");
```

In the sync block that currently reads:
```tsx
  if (appUser !== syncedAppUser) {
    setSyncedAppUser(appUser);
    setDisplayName(appUser?.displayName ?? "");
    setSlug(appUser?.slug ?? "");
  }
```
add the footer message line:
```tsx
  if (appUser !== syncedAppUser) {
    setSyncedAppUser(appUser);
    setDisplayName(appUser?.displayName ?? "");
    setSlug(appUser?.slug ?? "");
    setFooterMessage(appUser?.footerMessage ?? "");
  }
```

In `onSubmit`, the request body currently reads:
```tsx
        body: JSON.stringify({
          displayName,
          slug: normalizeSlug(slug),
        }),
```
Change to:
```tsx
        body: JSON.stringify({
          displayName,
          slug: normalizeSlug(slug),
          footerMessage,
        }),
```
(Non-Pro users submitting an unchanged empty string is harmless — `PATCH /api/profile`'s gating only rejects a *non-empty* `footerMessage` from a non-Pro user, per Task 6.)

Add the field itself into the form, right after the closing `</label>` of the "Household link" field and before the submit `<button>`:
```tsx
          <label className="block text-sm">
            <span className="font-medium text-ink">
              Footer message{" "}
              {!appUser?.isPro && (
                <span className="font-normal text-muted">(Pro)</span>
              )}
            </span>
            <textarea
              value={footerMessage}
              onChange={(e) => setFooterMessage(e.target.value.slice(0, 140))}
              disabled={!appUser?.isPro}
              placeholder="Back after school pickup around 3pm"
              rows={2}
              className="mt-1 w-full rounded-input border border-rule bg-paper px-4 py-3 text-ink focus-ring outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            />
            <span className="mt-1 block text-xs text-muted">
              {appUser?.isPro
                ? `A standing note your household sees below your status. ${footerMessage.length}/140`
                : "Upgrade to Pro on the dashboard to set this."}
            </span>
          </label>
```

- [ ] **Step 2: Render the footer message on the public share page**

In `src/app/s/[slug]/page.tsx`, add `footerMessage` to the `ShareData` type — currently:
```ts
type ShareData = {
  displayName: string | null;
  hasSchedule: boolean;
  workStart?: string;
  workEnd?: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  status?: ScheduleStatusValue | null;
  statusUntil?: string | null;
  statusMessage?: string | null;
};
```
add one line:
```ts
type ShareData = {
  displayName: string | null;
  hasSchedule: boolean;
  workStart?: string;
  workEnd?: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  status?: ScheduleStatusValue | null;
  statusUntil?: string | null;
  statusMessage?: string | null;
  footerMessage?: string | null;
};
```

Render it below the glass card, at the same visual tier as the existing `showTroubleNote` paragraph. The component currently ends with:
```tsx
      {showTroubleNote && (
        <p className="mt-6 text-xs text-muted">
          Having trouble updating — showing the last known status.
        </p>
      )}
    </div>
  );
}
```
Change to:
```tsx
      {data.footerMessage && (
        <p className="mt-6 max-w-sm text-sm text-ink-2">{data.footerMessage}</p>
      )}

      {showTroubleNote && (
        <p className="mt-6 text-xs text-muted">
          Having trouble updating — showing the last known status.
        </p>
      )}
    </div>
  );
}
```
`data.footerMessage` is placed above `showTroubleNote` (not merged into the same conditional) because they're independent, unrelated signals — one is household content, the other is a connectivity warning — and both should be able to show at once without fighting over the same paragraph.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: no errors.

- [ ] **Step 4: Manual verification**

As a Pro test user (via the dashboard upgrade flow completed in Task 7, or the temporary `psql` flip from Task 6), go to `/setup`, type a footer message, save. Visit `/s/<your-slug>` in an incognito window (no auth) and confirm the message renders below the status card. Go back to `/setup` as a non-Pro user (or flip `is_pro` back to `false` via `psql` for this check) and confirm the textarea is disabled with the "(Pro)" label and "Upgrade to Pro..." hint showing.

- [ ] **Step 5: Commit**

```bash
git add src/app/setup/page.tsx "src/app/s/[slug]/page.tsx"
git commit -m "feat: add Pro-gated footer message setup UI and share page render"
```

---

## Post-implementation

- [ ] Update `docs/BUILD-PLAN.md`'s Day 10 checklist. It currently reads "Pro $6/mo: recurring schedule, custom footer message, shutdown streak" — this is stale versus the actual locked decision (recurring schedule stayed free, shipped Day 8). Change to "Pro $6/mo: custom footer message, shutdown streak" and check the item off.
- [ ] Restart the dev server once more after all tasks land, to confirm a clean boot with the new schema/routes together (not just per-task).
