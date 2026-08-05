# Day 3 — Status Toggle — Design

**Date:** 2026-08-05
**Status:** Approved
**Scope:** BUILD-PLAN.md Day 3 — "Status enum, optional until time + short message, dashboard big status buttons"

## Goal

Let a signed-in user set their current status (`available` / `focused` /
`in_meeting` / `off_clock`) for today, with an optional "until" time and a
short free-text message, from the dashboard. This is the second piece of
"today's" state — Day 4's public share page will read work hours (Day 2)
and status (this) from the same row to render the household view.

## Non-goals (deferred to later days per BUILD-PLAN)

- Public `/s/[slug]` read view — Day 4
- Automatic status derivation from work hours/time of day — not in BUILD-PLAN
  at all; status is always a manual, explicit user action in v0.1
- Shutdown ritual setting status to `off_clock` automatically — Day 6/7
- Recurring/default status — not planned for v0.1

## Data model

Extend the existing `DaySchedule` model (not a new table) — status is
per-day state exactly like work hours, and Day 4 will read both from one
row. Add a native Postgres enum and three nullable columns:

```prisma
enum ScheduleStatus {
  available
  focused
  in_meeting
  off_clock
}

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
  statusUntil   String?         @map("status_until")   // "HH:mm", same convention as workStart/workEnd
  statusMessage String?         @map("status_message") // short free text, max 80 chars
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  @@unique([userId, date])
  @@map("day_schedules")
}
```

**Status requires an existing schedule row.** A status update only ever
`UPDATE`s an existing `DaySchedule` row (found via `(userId, date)`); it
never creates one. If no row exists yet for today (user hasn't set their
hours per Day 2's flow), the status endpoint returns 404 — the dashboard
UI won't even show the status panel until a schedule exists (see UI
section). This keeps a single natural entry point per day and avoids an
orphan status-only row with no hours for Day 4 to render.

## API

`src/app/api/schedule/status/route.ts` — one handler, `PATCH`, following
the exact guard pattern of `src/app/api/schedule/route.ts` (Firebase Admin
configured check → `getAuthUserFromRequest` → 401 → user lookup → 404 if
user not found):

- **`PATCH /api/schedule/status`** — body
  `{ date?: string, status: ScheduleStatus, statusUntil?: string, statusMessage?: string }`.
  `date` optional, defaults to today (same `getLocalDateString()` fallback
  as `/api/schedule`, though the real UI always sends its own local date,
  same as Day 2's fix).
  Validates:
  - `status` must be one of `available` / `focused` / `in_meeting` /
    `off_clock` — 400 `{ error }` otherwise
  - `statusUntil`, if present, must match `HH:mm` (reuse `isValidTime` from
    `src/lib/schedule.ts`) — 400 `{ error }` otherwise
  - `statusMessage`, if present, trimmed and capped at 80 characters — 400
    `{ error }` if longer (mirrors `profile/route.ts`'s `displayName`
    length-cap pattern)
  - Looks up the `DaySchedule` row for `(userId, date)`. If none exists:
    404 `{ error: "Set today's hours first." }` — no upsert, no implicit
    row creation.
  - On success: `UPDATE`s `status`, `statusUntil` (or `null` if omitted),
    `statusMessage` (trimmed, or `null` if omitted). Returns
    `{ schedule }` (the full updated row, same shape as `/api/schedule`'s
    responses, so the dashboard can use one type for both).

No `GET` on this route — the existing `GET /api/schedule` already returns
the full row including the new status fields, so the dashboard's existing
schedule-fetch covers status too; no second fetch needed.

## UI

Replace the "Your status" placeholder card in `src/app/dashboard/page.tsx`
with a new `src/components/status-panel.tsx` client component:

- **Gating:** only renders its interactive content once a `DaySchedule`
  exists for today. `DashboardPage` already fetches the schedule for
  `DayScheduleForm`; `StatusPanel` needs the same data (the schedule row,
  including any existing status) — lift that fetch up to `DashboardPage`
  and pass the schedule (and a refetch callback) down to both
  `DayScheduleForm` and `StatusPanel` as props, rather than each component
  independently fetching. If no schedule exists yet, `StatusPanel` renders
  a disabled/placeholder state: "Set today's hours first" (no buttons).
- **Buttons:** 4 large tap targets, one per `ScheduleStatus` value, styled
  as a toggle group (selected = filled teal, unselected = outline stone) —
  local `selectedStatus` state initialized from the schedule's current
  `status` (or `null` if unset).
- **Until + message:** once any status is selected (local state, not yet
  saved), reveal an optional `<input type="time">` for "until" and a short
  `<input type="text" maxLength={80}>` for the message, pre-filled from the
  schedule's existing `statusUntil`/`statusMessage` if the selected status
  matches what's already saved.
- **Save button:** one explicit "Save status" button (same explicit-save
  pattern as `DayScheduleForm` — no instant-tap auto-save per button,
  avoiding race conditions from rapid taps), calling
  `PATCH /api/schedule/status` with `{ date: getLocalDateString(), status: selectedStatus, statusUntil, statusMessage }`.
  Client-side pre-check before submit: `statusUntil` must be valid `HH:mm`
  if non-empty (reuse `isValidTime` from `@/lib/schedule` — same
  shared-validator lesson from Day 2's final review, don't hand-roll a
  parallel check); `statusMessage` length ≤ 80.
- Same error/saved-state UX as `DayScheduleForm`: inline error text on
  failure (including the 404 "set hours first" case, though the panel
  should already be gated against that), "Saved." confirmation, disabled
  button while saving, error surfaced (not swallowed) on non-2xx responses
  — applying the same lessons from Day 2's final review directly, not
  repeating those gaps.

## Error handling

- Unauthenticated / Firebase Admin not configured: same 401/503 shape as
  every other route in this project.
- No schedule row yet: 404 `{ error: "Set today's hours first." }` — UI
  gates against this case but the API still enforces it independently
  (never trust the client).
- Invalid `status` enum value, malformed `statusUntil`, or over-length
  `statusMessage`: 400 `{ error }`, client pre-checks the same rules before
  submit but the server is the source of truth.
- Network/save failure: inline error text, panel stays editable, no data
  loss (selection and field values are kept as typed).

## Testing

Same approach as Day 2 (no test framework in this project — documented,
deliberate):
- Prisma: `npx prisma validate` after schema change; `db:push` against the
  dev database; a throwaway script verifying the enum + new columns
  round-trip (create a `DaySchedule`, update its status fields, read back,
  assert), same pattern as Day 2's `_verify-day-schedule.mjs`.
- API: curl checks for the auth guard (401 without token) and the 404 path
  requires an authenticated request, which — same limitation as Day 2 —
  can't be curl-verified without a real Firebase token in this
  environment; that path gets hand-traced instead.
- UI: manual browser check once implemented — set hours (Day 2 flow), then
  set a status with until+message, save, reload, confirm persistence;
  toggle to a different status; try `off_clock` (no until/message needed);
  confirm a >80-char message is rejected client-side.

## Functionality shipped at the end of Day 3

- User can select one of 4 statuses (available / focused / in_meeting /
  off_clock) from the dashboard
- Optional "until" time and short message attach to the selected status
- Status is gated behind already having set today's hours (Day 2), keeping
  one natural per-day flow
- Status persists to the same `DaySchedule` row as work hours — reloading
  the dashboard shows the already-saved status, not blank
- Validation (enum value, `HH:mm` format, 80-char message cap) both client-
  and server-side, reusing `src/lib/schedule.ts`'s shared validator
  pattern rather than duplicating logic (the exact gap Day 2's final
  review caught and fixed)
- Foundation laid for Day 4's public share page, which will read
  `workStart`/`workEnd`/lunch/`status`/`statusUntil`/`statusMessage` all
  from one `DaySchedule` row per user per date
