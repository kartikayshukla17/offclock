# Day 4 — Public Share Page — Design

**Date:** 2026-08-08
**Status:** Approved
**Scope:** BUILD-PLAN.md Day 4 — "`/s/[slug]` read-only, no auth, mobile-first; shows name, work hours, current status, message, lunch window; auto-refresh or 30s polling"

## Goal

Let anyone with a user's share link (`/s/[slug]`) see that user's work hours,
lunch window, and current status — no login, no app install. This is the
actual household-facing artifact of the whole project; every prior day's
work (schedule, status) exists to feed this page.

## Non-goals (deferred to later days per BUILD-PLAN)

- Copy-link button + QR code generator — Day 5
- Historical/past-day views — never planned for v0.1
- Any write/interaction on this page — strictly read-only
- WebSocket/push updates — v0.1 is polling only
- Handling an "until" time that has already passed — noted as a Day 4
  spec gap by Day 3's final review; addressed below (see "Stale until").

## Data flow

Keep this codebase's established pattern: every existing page is a client
component that fetches via `useEffect`/`fetch`, not a Server Component
doing Prisma queries directly. This page also needs live polling regardless
(a Server Component's initial render wouldn't remove the need for a client
component to poll), so introducing a second data-fetching pattern here
would add inconsistency without removing the client-side requirement.

- New public API route: `GET /api/s/[slug]` — **no auth guard**, unlike
  every other route in this project. Looked up by `slug` on `User`, then
  today's `DaySchedule` row for that user (`getLocalDateString()` computed
  **client-side** and sent as `?date=`, exactly like Day 2/3's fix — never
  rely on the server's own clock for "today").
- New client page: `src/app/s/[slug]/page.tsx` — fetches on mount, then
  polls every 30 seconds via `setInterval`, clearing the interval on
  unmount.

## API response shape

Only fields safe to expose publicly. Never `email`, `firebaseUid`, or `id`.

- `404 { error: "Not found" }` if no `User` with that `slug` exists.
- `200 { displayName: string | null, hasSchedule: false }` if the user
  exists but has no `DaySchedule` row for today yet (hasn't set up their
  day) — distinguishable from the 404 case so the page can show a
  friendly "hasn't set up today yet" state instead of "this link is
  broken."
- `200 { displayName: string | null, hasSchedule: true, workStart: string, workEnd: string, lunchStart: string | null, lunchEnd: string | null, status: ScheduleStatusValue | null, statusUntil: string | null, statusMessage: string | null }`
  when today's schedule exists.

## Stale "until" handling

Day 3's final review flagged this as an open spec gap: nothing expires a
status, so `statusUntil` can be a past time (e.g. "until 14:00" still
showing at 6pm) with nothing signaling it's stale. For Day 4's read-only
display: if `statusUntil` is present and earlier than the current
client-side clock time, the page shows the status and message as-is but
**omits the "until HH:mm" text** (still true that they were "in a
meeting", just not usefully true that it ends at a time that's already
passed). This is a display-only rule — no data is changed, no write
happens. Comparison happens client-side (browser's own clock), consistent
with this project's "browser-local, not server-local" time convention.

## UI

Mobile-first, no dashboard chrome (no header/nav — this is the "stick it
on a kitchen tablet" view, not a page someone navigates around in):

- User's `displayName` (fallback: "This household" if null) as a heading
- A large status indicator: icon + color + text label together — not
  color alone (this project's Day 11 accessibility backlog already flags
  color-only status as a concern; not repeating it here)
- Work hours (`workStart`–`workEnd`)
- Lunch window, if set (`lunchStart`–`lunchEnd`)
- `statusMessage`, if set
- "Until HH:mm", if set and not stale (see above)
- If `hasSchedule` is `false`: a friendly placeholder — "Hasn't set up
  today's schedule yet" — no error styling
- If the slug 404s: a simple "This link isn't valid" page, no navigation
  back into the app (there's nothing to navigate to — visitors aren't
  signed in)

## Error handling

- Invalid/unknown slug: 404 from the API, page renders "This link isn't
  valid."
- Network/fetch failure (including a failed poll): keep showing the last
  successfully loaded data rather than clearing the screen — a household
  member glancing at a kitchen tablet shouldn't see the page go blank
  because of a transient network blip. Show a small, unobtrusive "having
  trouble updating" note only if the fetch has failed 2+ consecutive times
  (avoids flashing an error on every brief hiccup), not on the first
  retry.

## Testing

Same approach as Days 2–3 (no test framework in this project — documented,
deliberate):
- API: curl checks — unknown slug → 404; valid slug with no schedule →
  `200 { hasSchedule: false }`; this route needs **no auth token** to
  test, unlike every prior route, so the happy-path response actually IS
  curl-verifiable end-to-end for the first time in this project (no
  Firebase-token limitation blocking verification).
- UI: manual browser check once implemented — visit a real slug's share
  page, confirm it renders the currently-saved schedule/status; edit
  status on the dashboard in another tab, confirm the share page picks it
  up within 30s; visit an invalid slug, confirm the "not valid" state.

## Functionality shipped at the end of Day 4

- Anyone with a `/s/[slug]` link can see that user's current work hours,
  lunch window, status, message, and "until" time (when not stale) —
  no login required
- Page keeps itself current via 30s polling, degrading gracefully (keeps
  last-known data) on transient fetch failures
- No private fields (email, Firebase UID, internal IDs) ever reach the
  public response
- Distinguishes "link doesn't exist" (404) from "user exists but hasn't
  set up today" (friendly placeholder) — the two are different situations
  and shouldn't look the same to a visitor
- Foundation for Day 5 (copy-link + QR code, both just need this same URL)
