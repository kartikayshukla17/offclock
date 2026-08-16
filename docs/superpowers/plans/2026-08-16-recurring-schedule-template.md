# Day 8 — Recurring Schedule Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user save their current work hours as a default Mon–Fri template, then apply that template to any day's schedule in one tap.

**Architecture:** Task 1 extends the data layer — two nullable columns on `User`, wired through the existing `PATCH /api/profile` endpoint (already handles `displayName`/`slug`), plus the `AppUser` type. Task 2 extends `DayScheduleForm` with a "use as default" checkbox on save, and an "Apply to today" button that reuses the existing `PUT /api/schedule` endpoint. No new endpoints, no new components.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 6 + Neon Postgres. No new dependencies.

## Global Constraints

- The default template is work hours only (`defaultWorkStart`/`defaultWorkEnd`) — no lunch fields. "Apply to today" never touches whatever lunch window is currently in the form.
- Saving with "use as default" checked is one user action that fires two requests in sequence (`PUT /api/schedule` then `PATCH /api/profile`) — both must succeed for the save to report success; if the profile patch fails after the schedule save succeeded, show the profile-patch error (the schedule row IS saved at that point — don't claim total failure).
- After a successful default-template save, the checkbox resets to unchecked — it's a per-save opt-in, not a sticky setting.
- "Apply to today" is only shown once a default exists (`appUser.defaultWorkStart && appUser.defaultWorkEnd` both non-null).
- Every new async call follows the existing three-branch error pattern already in this file (`!token` → signed-out copy, `!res.ok` → server message with fallback, `catch` → connection copy).

---

### Task 1: Schema + API — `defaultWorkStart`/`defaultWorkEnd` on `User`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/components/auth-provider.tsx`

**Interfaces:**
- Consumes: `validateScheduleTimes` from `src/lib/schedule.ts` (already exists, already validates `workStart`/`workEnd` with lunch fields optional).
- Produces: `User.defaultWorkStart/defaultWorkEnd: String?` (Prisma fields, returned by every route that already returns the full `user` object — `GET /api/profile`, `PATCH /api/profile`, `POST /api/auth/sync` — no changes needed to those beyond the schema/type); `PATCH /api/profile` accepts optional `defaultWorkStart?: string`, `defaultWorkEnd?: string` in its JSON body, must be provided together; `AppUser.defaultWorkStart/defaultWorkEnd: string | null`. Task 2 reads these off `appUser` (from `useAuth()`) and calls `PATCH /api/profile` with these two fields.

- [ ] **Step 1: Add the two columns to the Prisma schema**

In `prisma/schema.prisma`, find the `User` model:

```prisma
model User {
  id          String   @id @default(cuid())
  firebaseUid String   @unique @map("firebase_uid")
  email       String   @unique
  displayName String?  @map("display_name")
  slug        String?  @unique
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  daySchedules DaySchedule[]

  @@map("users")
}
```

Add two fields after `slug`:

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

- [ ] **Step 2: Regenerate the client and push the schema**

Run: `npx prisma generate` — reads `schema.prisma` locally, no DB connection needed.

Run: `npx prisma db push` — this environment has real `DATABASE_URL` credentials (check for `.env` or `.env.local` before assuming otherwise; if genuinely absent, note it clearly in your report instead of skipping silently). Confirm the output reports success with no destructive-change warning (there shouldn't be one — these are new nullable columns).

- [ ] **Step 3: Extend `PATCH /api/profile`'s request body type and validation**

In `src/app/api/profile/route.ts`, add the import at the top of the file:

```tsx
import { validateScheduleTimes } from "@/lib/schedule";
```

Find:

```tsx
  const body = (await request.json()) as {
    displayName?: string;
    slug?: string;
  };

  const data: { displayName?: string; slug?: string } = {};
```

Replace with:

```tsx
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

- [ ] **Step 4: Add the validation block**

In the same file, find the end of the slug-handling block (right before the `Object.keys(data).length === 0` check):

```tsx
    data.slug = slug;
  }

  if (Object.keys(data).length === 0) {
```

Replace with:

```tsx
    data.slug = slug;
  }

  if (body.defaultWorkStart !== undefined || body.defaultWorkEnd !== undefined) {
    if (
      typeof body.defaultWorkStart !== "string" ||
      typeof body.defaultWorkEnd !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "defaultWorkStart and defaultWorkEnd must both be provided together.",
        },
        { status: 400 },
      );
    }
    const templateError = validateScheduleTimes({
      workStart: body.defaultWorkStart,
      workEnd: body.defaultWorkEnd,
    });
    if (templateError) {
      return NextResponse.json({ error: templateError }, { status: 400 });
    }
    data.defaultWorkStart = body.defaultWorkStart;
    data.defaultWorkEnd = body.defaultWorkEnd;
  }

  if (Object.keys(data).length === 0) {
```

- [ ] **Step 5: Extend the `AppUser` type**

In `src/components/auth-provider.tsx`, find:

```tsx
export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  slug: string | null;
};
```

Replace with:

```tsx
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

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npx eslint src` — expect no errors (use `eslint src`, not a bare `eslint`, to avoid a known false-positive from scanning nested worktree `.next` build caches if one happens to be present).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/app/api/profile/route.ts src/components/auth-provider.tsx
git commit -m "feat: add default work-hours template fields to User"
```

---

### Task 2: `DayScheduleForm` — "use as default" checkbox + "Apply to today"

**Files:**
- Modify: `src/components/day-schedule-form.tsx`

**Interfaces:**
- Consumes: `appUser`, `refreshProfile` from `useAuth()` (already provides `getIdToken`, this component already imports the hook); `appUser.defaultWorkStart/defaultWorkEnd` (Task 1).
- Produces: no new external interface — this is the last piece of this feature.

- [ ] **Step 1: Read `appUser` and `refreshProfile` from the auth hook**

In `src/components/day-schedule-form.tsx`, find:

```tsx
  const { getIdToken } = useAuth();
```

Replace with:

```tsx
  const { getIdToken, appUser, refreshProfile } = useAuth();
```

- [ ] **Step 2: Add the "use as default" checkbox state**

Find:

```tsx
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
```

Replace with:

```tsx
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [useAsDefault, setUseAsDefault] = useState(false);
```

- [ ] **Step 3: Extract the schedule-save fetch into a reusable helper, and add a default-template-save helper**

Find the whole `handleSave` function:

```tsx
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
```

Replace with these four functions (two low-level fetch helpers, plus the two rewritten handlers — `handleSave` keeps its name and is still what the existing Save button calls, `handleApplyDefault` is new and wired to the new button in Step 4):

```tsx
  async function putSchedule(
    start: string,
    end: string,
    lunch: { start: string; end: string } | null,
  ): Promise<boolean> {
    const token = await getIdToken();
    if (!token) {
      setError("You're signed out — refresh and sign in again.");
      return false;
    }
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: getLocalDateString(),
        workStart: start,
        workEnd: end,
        lunchStart: lunch?.start,
        lunchEnd: lunch?.end,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not save schedule.");
      return false;
    }
    return true;
  }

  async function patchDefaultTemplate(start: string, end: string): Promise<boolean> {
    const token = await getIdToken();
    if (!token) {
      setError("You're signed out — refresh and sign in again.");
      return false;
    }
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ defaultWorkStart: start, defaultWorkEnd: end }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not save your default hours.");
      return false;
    }
    await refreshProfile();
    return true;
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
      const ok = await putSchedule(
        workStart,
        workEnd,
        hasLunch ? { start: lunchStart, end: lunchEnd } : null,
      );
      if (!ok) return;
      if (useAsDefault) {
        const defaultOk = await patchDefaultTemplate(workStart, workEnd);
        if (!defaultOk) return;
        setUseAsDefault(false);
      }
      setSaved(true);
      onSaved();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyDefault() {
    if (!appUser?.defaultWorkStart || !appUser?.defaultWorkEnd) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const ok = await putSchedule(
        appUser.defaultWorkStart,
        appUser.defaultWorkEnd,
        hasLunch ? { start: lunchStart, end: lunchEnd } : null,
      );
      if (!ok) return;
      setWorkStart(appUser.defaultWorkStart);
      setWorkEnd(appUser.defaultWorkEnd);
      setSaved(true);
      onSaved();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }
```

Note on the "both succeed" constraint from Global Constraints: `handleSave` returns early (via the bare `return` inside the `try`) as soon as either `putSchedule` or `patchDefaultTemplate` reports failure, each having already called `setError` with the specific reason — so the error the user sees always names which half failed. `setSaved(true)` only runs after both requested operations (schedule save, and default save if checked) have succeeded.

- [ ] **Step 4: Add the "Apply to today" button and the "use as default" checkbox to the render**

Find the `<h2>` title line:

```tsx
      <h2 className="font-display font-medium text-ink">
        Today&apos;s schedule
      </h2>
```

Replace with (adds the conditional "Apply to today" button directly below the title):

```tsx
      <h2 className="font-display font-medium text-ink">
        Today&apos;s schedule
      </h2>

      {appUser?.defaultWorkStart && appUser?.defaultWorkEnd && (
        <button
          type="button"
          onClick={handleApplyDefault}
          disabled={saving}
          className="focus-ring mt-2 rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-55"
        >
          Apply my usual hours (
          <span className="font-mono">
            {appUser.defaultWorkStart}–{appUser.defaultWorkEnd}
          </span>
          )
        </button>
      )}
```

Then find the lunch checkbox block:

```tsx
      <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={hasLunch}
          onChange={(e) => setHasLunch(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Add lunch window
      </label>
```

Leave that block exactly as-is, and add the new checkbox directly after the whole `{hasLunch && (...)}` conditional block that follows it (i.e., right before the `{error && ...}` line):

```tsx
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
```

becomes:

```tsx
      <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={useAsDefault}
          onChange={(e) => setUseAsDefault(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        Use as my default Mon–Fri hours
      </label>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit` — expect no errors.
Run: `npx eslint src` — expect no errors.

- [ ] **Step 6: Dev-server smoke check**

Run `npm run dev` in the background, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard` — expect `200`. Stop the dev server afterward. This confirms the page compiles — it does not exercise the actual save flow (needs a live signed-in session), note that as an outstanding manual-verification item in your report.

- [ ] **Step 7: Commit**

```bash
git add src/components/day-schedule-form.tsx
git commit -m "feat: add default-hours checkbox and Apply-to-today button"
```

---

## After this plan

A human still needs to manually verify: save today's hours with "Use as my default Mon–Fri hours" checked, confirm the checkbox resets to unchecked afterward and `GET /api/profile` shows the new `defaultWorkStart`/`defaultWorkEnd`; reload the dashboard and confirm the "Apply my usual hours (…)" button appears with the correct times; on a different day (or after clearing today's schedule), click it and confirm today's hours update to the default and lunch is left untouched.

Day 9 (landing page) is the next code task after this plan lands, per `docs/BUILD-PLAN.md`.
