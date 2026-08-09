# OffClock

Shareable status page for WFH households — plus a 5-minute shutdown ritual so work actually ends.

*Your household knows when you're off the clock.*

One link, no login for them, no app to install. Set your hours and status once; the page they open updates itself every 30 seconds.

**Status:** Days 1–4 shipped — auth, daily schedule, status toggle (available / focused / in a meeting / off the clock), and the public share page are all live. Copy-link + QR code (Day 5) is next.

## How it works

- `/dashboard` (auth required) — set today's work hours, optional lunch window, and your current status with an optional "back by" time and short note
- `/s/[your-slug]` (no login) — the page your household actually opens: your hours, status, and message, polling for updates every 30s

## Stack

- **App:** Next.js 16 (App Router) + React 19 + Tailwind 4
- **Auth:** Firebase Auth (Google + email)
- **DB:** Prisma + Neon Postgres
- **Design:** custom OKLCH token system (`design.md`, `tokens.css`) — glassmorphism cards, Bricolage Grotesque + Geist type

## Dev docs

| File | Purpose |
|------|---------|
| [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) | 14-day build schedule |
| [design.md](design.md) | Locked design system every page reads from |

## Local setup

```bash
cp .env.example .env.local
# Fill Firebase client + admin + DATABASE_URL (Neon)

npm install
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → Sign in → `/setup` → `/dashboard`

## License

MIT — see [LICENSE](LICENSE).
