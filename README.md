# OffClock

Shareable status page for WFH households — plus a 5-minute shutdown ritual so work actually ends.

**Status:** Day 1 — auth + profile + dashboard shell

## Docs

| File | Purpose |
|------|---------|
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | 14-day dev schedule |
| [docs/BUILD-IN-PUBLIC-CALENDAR.md](docs/BUILD-IN-PUBLIC-CALENDAR.md) | Daily posts + channel guide |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | Verchool MOU/NDA review |
| [docs/verchool-notification.md](docs/verchool-notification.md) | Notification sent ✓ |

## Stack

- **App:** Next.js 16 (App Router) + Tailwind 4
- **Auth:** Firebase Auth (Google + email)
- **DB:** Prisma + Neon Postgres

## Local setup

```bash
cp .env.example .env.local
# Fill Firebase client + admin + DATABASE_URL (Neon)

npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → Sign in → `/setup` → `/dashboard`

## Positioning

*Your household knows when you're off the clock.*
