# Day 6 — Shutdown Ritual Wizard (Steps 1–3) — Design

**Date:** 2026-08-11
**Status:** Approved
**Scope:** BUILD-PLAN.md Day 6 — "Modal/wizard: capture loose thought → tomorrow top 3 → confirm tomorrow hours"

## Goal

A 3-step modal wizard, launched from the dashboard, that walks through a
lightweight end-of-day shutdown: externalize whatever's still nagging at
you, name tomorrow's top 3 priorities, and confirm tomorrow's work hours.
This is steps 1–3 only — the actual "you're done, status flips to off the
clock" moment is Day 7's job, not this one.

## Where it lives

`src/app/dashboard/page.tsx` already has a placeholder 4th grid card:

```tsx
<PlaceholderCard
  title="Shutdown ritual"
  detail="Off the clock flow — Day 6"
/>
```

This becomes a real button that opens the wizard. This is the first true
modal in the app — everything else so far (`TimeSelect`) is a small
anchored popover. New component: `src/components/shutdown-wizard.tsx`.

## Modal shell

Fixed-position overlay: a dimmed scrim (`bg-ink/40` or similar) covering
the viewport, with a centered card. The card itself uses solid `bg-paper`
(not `.glass`) — same reasoning as the QR panel from Day 5: an
interactive overlay needs to occlude what's behind it, glass is for
static decorative surfaces. Closes on Escape key or backdrop click. No
"are you sure" confirmation on close — nothing of consequence is lost by
closing early (see below), so a plain close is fine.

## Step 1 — Loose thought

A single textarea: "What's still on your mind?" Optional. **Not
persisted anywhere** — typing it out and moving on is the entire point
(this is Cal Newport's actual mechanism: externalizing an open loop so
your brain stops holding it, not building an archive of notes). The
textarea's content is discarded the moment the modal closes, whether via
Next, Escape, or backdrop click.

## Step 2 — Tomorrow's top 3

Three short text inputs, all optional, no minimum-fill requirement.
Labeled generically ("Priority 1/2/3") rather than forcing exactly three
non-empty entries — some days you genuinely don't have three things.

**Not displayed anywhere yet.** Persisted (see below) so the data isn't
thrown away, but no dashboard surface reads it back tomorrow. That's
explicitly deferred — the wizard's value stands on its own as a planning
exercise even before there's a display feature consuming the result.

## Step 3 — Confirm tomorrow's hours

Two `TimeSelect` fields (start/end), the same component `DayScheduleForm`
already uses. Prefilled with **today's** confirmed work hours as a
starting default (most days repeat), fully editable. Validated with the
existing `validateScheduleTimes` (end must be after start) before the
wizard's final "Confirm" button can submit.

## Persistence — extending, not duplicating

`PUT /api/schedule` already upserts a `DaySchedule` row for an arbitrary
`date` (not just today) — this is exactly what "confirm tomorrow's
hours" needs, so no new endpoint. Two changes:

1. **Schema:** add three nullable columns to `DaySchedule` —
   `topPriority1`, `topPriority2`, `topPriority3` (all `String?`,
   matching the plain-nullable-string style already used for
   `lunchStart`/`lunchEnd`/`statusMessage` rather than a Postgres array
   column — explicit fixed slots over a variable-length list, consistent
   with how `workStart`/`workEnd` are separate fields rather than an
   array).
2. **API:** `PUT /api/schedule`'s body type and upsert `create`/`update`
   blocks both gain the three optional fields, written through as-is (no
   validation beyond "it's a string or absent" — these are free-text
   priorities, not times).

The wizard's final "Confirm" button fires **one** `PUT /api/schedule`
call with `date` set to tomorrow's date (a new `getTomorrowDateString()`
helper alongside the existing `getLocalDateString()` in `src/lib/schedule.ts`),
plus `workStart`, `workEnd`, and the three `topPriority` fields. The
loose-thought textarea's content is never included in this request.

If tomorrow's `DaySchedule` row already exists (e.g. the user re-opens
the wizard and runs it again same evening), the upsert's `update` branch
overwrites `workStart`/`workEnd`/`topPriority1-3` on that row and leaves
`status`/`statusUntil`/`statusMessage` untouched — correction from an
earlier draft of this spec: **lunch fields are NOT left untouched.**
`PUT /api/schedule` has full-row-replace semantics for every field it
accepts; since the wizard never sends `lunchStart`/`lunchEnd`, those get
nulled on the target row just like an omitted `topPriority` does. This is
currently unreachable in practice (the only UI that sets lunch,
`DayScheduleForm`, always writes today's date, and nothing today can
place a lunch window on a date the wizard later overwrites), but it's a
real architectural constraint: **this endpoint now has two partial-update
clients, and every field either one omits gets nulled.** That's fine
while the two clients write disjoint dates. It stops being fine the
moment a third writer (or a "plan any date" surface) is added — worth
keeping in mind for Day 7 rather than something to fix now.

## Error handling

Same pattern as `DayScheduleForm`: auth-token failure shows "You're
signed out — refresh and sign in again"; a non-2xx API response shows
its error message inline; a network failure shows "Couldn't save — check
your connection and try again." No optimistic UI — the modal stays open
with the error visible until the user retries or cancels.

## Non-goals (this task)

- No status change to `off_clock`, no shutdown-completion timestamp —
  Day 7's "final step."
- No display of tomorrow's top 3 anywhere (dashboard, share page) — a
  later, separate task once the wizard exists to feed it.
- No persistence of the loose-thought text, ever.
- No "resume where you left off" if the modal is closed mid-wizard —
  reopening always starts at step 1 with blank/default fields (defaults
  re-derived from today's schedule, not from a prior abandoned attempt).

## Testing

Same approach as the rest of this project (no test framework):
- `npx tsc --noEmit`, `npm run lint` — must stay clean.
- `npx prisma generate` after the schema migration, to keep the
  generated client in sync.
- Manual browser check once implemented (needs a human): open the
  wizard from the dashboard card, step through all three steps, confirm
  tomorrow's hours save (check via `GET /api/schedule?date=<tomorrow>`
  or by reloading the dashboard the "next day" locally), confirm the
  loose-thought text is genuinely gone after closing (no network request
  contains it — checkable via browser devtools Network tab), confirm
  Escape and backdrop-click both close the modal.

## Functionality shipped at the end of this task

- A working 3-step shutdown wizard, reachable from the dashboard.
- Tomorrow's work hours and top-3 priorities captured and persisted,
  ready for a future task to either display them back or build Day 7's
  completion step on top of this foundation.
