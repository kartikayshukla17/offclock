# Day 10 — Stripe + Pro Tier Design

## Decisions (already locked via prior AskUserQuestion round)

- Stripe **Checkout** (hosted, redirect-based) over Stripe Elements — least code, PCI scope stays entirely on Stripe.
- Recurring schedule template stays **free** (shipped Day 8, not retroactively gated).
- Pro ($6/mo) unlocks exactly two things:
  1. **Custom footer message** — a standing text line the household sees on the public `/s/[slug]` page.
  2. **Shutdown streak** — dashboard-only display, not shown on the public share page.
- Gating is **server-side**, not just UI-hidden — a downgraded user's custom message and Pro UI must disappear even if they never touch the client.
- Test mode only (`sk_test_`/`pk_test_` keys, already in `.env.local`).
- Streak resets **strictly** on any missed day — no grace period.

## Schema changes (`prisma/schema.prisma`)

Add to `User`:
```prisma
stripeCustomerId String? @unique @map("stripe_customer_id")
isPro            Boolean @default(false) @map("is_pro")
footerMessage    String? @map("footer_message")
```

No new tables. `DaySchedule.shutdownAt` (already exists) is the sole input to the streak calculation — no new streak-counter column, to avoid drift between a stored counter and the underlying rows.

## Streak calculation (server-computed, not stored)

Given "strict reset, no grace period," but a user mid-day who hasn't shut down *yet today* shouldn't see their streak zeroed out before they've had a chance to act. Algorithm:

1. Query the user's `DaySchedule` rows with `shutdownAt IS NOT NULL`, ordered by `date` descending, capped at the most recent 400 rows.
2. If none exist, streak = 0.
3. Take the most recent row with `shutdownAt` set. If its `date` is older than **yesterday** (i.e. more than one calendar day before today, using the client-supplied local date — same `?date=` convention as `/api/schedule`), the streak is broken: streak = 0.
4. Otherwise walk backward day-by-day starting from that most recent shutdown date, counting consecutive days present with `shutdownAt` set, stopping at the first gap. That count is the streak.

This means: shutting down today or yesterday keeps the streak alive and counting; missing yesterday *and* today zeroes it.

## New routes

### `POST /api/stripe/checkout`
- Auth required (same `getAuthUserFromRequest` pattern as `/api/profile`).
- Creates a Stripe Checkout Session: `mode: "subscription"`, `line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }]`, `client_reference_id: decoded.uid`, `customer_email: user.email` (only if the user has no `stripeCustomerId` yet — otherwise pass `customer: user.stripeCustomerId` instead of `customer_email`), `success_url: ${NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`, `cancel_url: ${NEXT_PUBLIC_APP_URL}/dashboard`.
- Returns `{ url: session.url }`. Client redirects `window.location.href = url`.

### `POST /api/stripe/webhook`
- **No auth header check** — Stripe calls this directly. Instead verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` via `stripe.webhooks.constructEvent`, using the **raw request body** (Next.js route handlers get this via `request.text()`, not `request.json()` — signature verification fails against re-serialized JSON).
- Handles two event types (MVP scope, matches what's needed for a working demo — not building dunning/past-due handling today):
  - `checkout.session.completed` — read `session.client_reference_id` (the `firebaseUid`) and `session.customer` (the Stripe customer id). `prisma.user.update({ where: { firebaseUid }, data: { isPro: true, stripeCustomerId: customer } })`.
  - `customer.subscription.deleted` — read `subscription.customer`. `prisma.user.update({ where: { stripeCustomerId: customer }, data: { isPro: false } })`.
- Returns `200` on success (Stripe retries on non-2xx). Returns `400` on signature verification failure.

### `POST /api/stripe/portal`
- Auth required.
- Loads the user, 400s if `stripeCustomerId` is null (they've never subscribed).
- Creates a Billing Portal session: `stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: ${NEXT_PUBLIC_APP_URL}/dashboard })`.
- Returns `{ url: session.url }`.

## Existing routes to touch

- **`GET /api/profile`** — no code change needed; it already spreads the full `User` record, so `isPro`/`footerMessage` ride along automatically once the schema migration lands. `stripeCustomerId` also rides along — harmless to expose to its own owner.
- **`PATCH /api/profile`** — accept an optional `footerMessage` field. Reject with `403` (`"Pro required."`) if the caller sets a non-empty `footerMessage` while `user.isPro` is `false`. Allow clearing it (`footerMessage: ""` → `null`) regardless of Pro status, so a downgraded user isn't stuck unable to remove stale text. Trim, cap at 140 chars (matches the general "short standing line" intent — no existing precedent field to match length against, this is a new reasonable ceiling for a footer strip).
- **`GET /api/s/[slug]`** — include `footerMessage: user.isPro ? user.footerMessage : null` in the response. Gating happens here, not just at write time, so a lapsed subscription hides the message immediately without needing to clear the stored value.

## New route

### `GET /api/streak`
- Auth required. Runs the streak calculation above for the caller. Returns `{ streak: number }`.
- Separate from `/api/profile` because it requires a `DaySchedule` query (a different, heavier read) — keeping it its own endpoint means the dashboard's cheap profile fetch doesn't pay for it on every load, and the endpoint's purpose stays legible from its name.

## Client changes

- **`AppUser` type** (`src/components/auth-provider.tsx`) — add `isPro: boolean`, `footerMessage: string | null`.
- **Dashboard** (`src/app/dashboard/page.tsx`):
  - If `!appUser.isPro`: an "Upgrade to Pro — $6/mo" card/button that `POST`s `/api/stripe/checkout` and redirects to the returned URL.
  - If `appUser.isPro`: a streak card (fetches `GET /api/streak` on mount) showing the current count, plus a "Manage subscription" link/button that `POST`s `/api/stripe/portal` and redirects.
  - Handle `?upgraded=1` in the URL post-redirect by calling `refreshProfile()` so `isPro` reflects the just-completed checkout without a manual reload.
- **Setup page** (`src/app/setup/page.tsx`) or a small new settings block: a `footerMessage` text input. Disabled with an "Upgrade to Pro to set this" hint when `!appUser.isPro`; otherwise editable and saved via the existing `PATCH /api/profile` pattern already in that file.
- **Public share page** (`src/app/s/[slug]/page.tsx`): render `data.footerMessage` (when present) as a small text line below the glass card — same visual tier as the existing `showTroubleNote` line, not inside the card itself (keeps it visually distinct from the live status content).

## New dependency

`stripe` npm package (server-side SDK). No client-side Stripe.js needed since Checkout and the Billing Portal are both full-page redirects, not embedded elements.

## Out of scope for this pass

- Proration, plan changes, multiple price tiers — one price, one product.
- Dunning/past-due handling beyond the hard `isPro: false` flip on `subscription.deleted`.
- Annual billing option.
- Free-trial period.
