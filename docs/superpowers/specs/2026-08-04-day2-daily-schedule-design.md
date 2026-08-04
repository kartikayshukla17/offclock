# Day 2 — Daily Schedule — Design

**Date:** 2026-08-04
**Status:** Approved
**Scope:** BUILD-PLAN.md Day 2 — "Set work start/end for today, optional lunch window, save to DB"

## Goal

Let a signed-in user set today's work hours (start/end) and an optional lunch
window, persisted per calendar date. This is the data Day 3 (status toggle)
and Day 4 (public share page) will read and display to the household.

## Non-goals (deferred to later days per BUILD-PLAN)

- Status enum / big status buttons — Day 3
- Public `/s/[slug]` read view — Day 4
- Recurring weekly template / "apply to today" — Day 8
- Timezone-aware scheduling — out of scope for v0.1; see "Time handling" below

## Time handling

Times are stored as plain `HH:mm` strings tied to a plain calendar `date`
(no timezone). "Today" means the browser's local calendar date for whoever
is looking — the owner when editing, the household when viewing later. This
matches the existing codebase's stance (no timezone handling anywhere yet)
and the plan's YAGNI scope. Single-household v0.1 assumes owner and viewers
share a timezone; revisit only if that assumption breaks in practice.

## Data model

New `DaySchedule` model in `prisma/schema.prisma`, one row per user per date
(upserted — never duplicated), following the existing `users` table's
`@map`/snake_case column convention:

```prisma
model DaySchedule {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime @db.Date
  workStart   String   @map("work_start")   // "HH:mm"
  workEnd     String   @map("work_end")     // "HH:mm"
  lunchStart  String?  @map("lunch_start")
  lunchEnd    String?  @map("lunch_end")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([userId, date])
  @@map("day_schedules")
}
```

`User` gains a back-relation: `daySchedules DaySchedule[]`.

The `@@unique([userId, date])` constraint is what makes "set today's hours"
an idempotent upsert rather than an ever-growing list, and is also what Day 8's
"apply template to today" will upsert against.

## API

`src/app/api/schedule/route.ts`, mirroring `src/app/api/profile/route.ts`'s
existing shape exactly (same guard order: Firebase Admin configured check →
`getAuthUserFromRequest` → 401 if absent → Prisma call):

- **`GET /api/schedule?date=YYYY-MM-DD`** — `date` optional, defaults to
  today (server's date, since this is same-day-only for v1). Looks up the
  requesting user's `DaySchedule` for that date. Returns `{ schedule: null }`
  if none set yet (not a 404 — "no schedule yet" is a normal, expected state,
  not an error).
- **`PUT /api/schedule`** — body `{ date?: string, workStart: string, workEnd: string, lunchStart?: string, lunchEnd?: string }`.
  `date` optional, defaults to today. Validates:
  - `workStart`/`workEnd` match `HH:mm`, `workEnd > workStart`
  - if either lunch field is present, both must be, matching `HH:mm`, and
    `workStart <= lunchStart < lunchEnd <= workEnd`
  - on validation failure: `400` with a single human-readable `error` string
    (matches `profile/route.ts`'s error shape)
  - Upserts on `(userId, date)`. Returns `{ schedule }`.

No `DELETE` in v1 — clearing lunch is done by omitting the lunch fields in a
`PUT`, which the upsert overwrites to `null`.

## UI

Replace the "Today's schedule" placeholder card in
`src/app/dashboard/page.tsx` with a new `src/components/day-schedule-form.tsx`
client component:

- On mount: `GET /api/schedule` (today), populate fields if present, else
  show empty inputs
- Fields: work start / end (`<input type="time">`), a checkbox/toggle
  "Add lunch window" that reveals lunch start/end time inputs when checked
- Save button → `PUT /api/schedule`; disable while saving; show inline error
  text on validation failure (same card, no modal/toast — matches the app's
  minimal-chrome style so far)
- On success: show a brief "Saved" confirmation state and reflect the saved
  values (so a refresh isn't needed to see it stuck)
- Visual style: same rounded-2xl / stone-border / white-bg card language as
  the other dashboard cards; teal accent for the save button, consistent
  with the existing teal share-link banner

## Error handling

- Unauthenticated / Firebase Admin not configured: same 401/503 shape as
  `profile/route.ts` — the form treats either as "not logged in," redirect
  already handled by `DashboardShell`.
- Invalid time input (e.g., end before start): client does a quick sanity
  check before submit to avoid a round trip, but the server is the source of
  truth (same double-validation pattern as `profile/route.ts`'s slug checks).
- Network/save failure: inline error text, form stays editable, no data loss
  (fields keep whatever the user typed).

## Testing

- Prisma: `npx prisma validate` after schema change; `db:push` against the
  dev database to confirm the migration applies cleanly.
- API: manual check via the running dev server (no test harness exists yet
  in this project) — GET with no schedule returns `{ schedule: null }`, PUT
  with valid/invalid payloads behaves as specified above.
- UI: manual browser check — empty state, fill + save, reload confirms
  persistence, invalid range shows inline error.

## Functionality shipped at the end of Day 2

- User can set today's work start/end time from the dashboard
- User can optionally add a lunch window (start/end) within their work hours
- Schedule is saved to Postgres via Prisma, scoped to that user + that date
- Reloading the dashboard shows the already-saved schedule (not blank)
- Validation prevents nonsensical ranges (end before start, lunch outside
  work hours) both client- and server-side
- Foundation laid for Day 3 (status toggle reads/writes alongside this),
  Day 4 (public share page reads `workStart`/`workEnd`/lunch to display),
  and Day 8 (recurring weekly template upserts into this same table)
