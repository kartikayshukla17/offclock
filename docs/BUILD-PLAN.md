# OffClock — 14-Day Build Plan

**Total dev time:** 14 working days (~3 weeks at 2–3 hrs/day alongside Verchool)  
**MVP scope:** Auth + daily schedule + public share page + status toggles + shutdown ritual + landing page

**Positioning:** *Your household knows when you're off the clock.*

---

## Phase overview

| Phase | Days | Deliverable |
|-------|------|-------------|
| 0 — Compliance | Day 0 | Verchool notification sent |
| 1 — Core loop | Days 1–5 | Share page live (manual schedule + status) |
| 2 — Shutdown | Days 6–8 | End-of-day ritual updates share page |
| 3 — Polish + launch | Days 9–12 | Landing page, QR code, Stripe |
| 4 — Launch + outreach | Days 13–14 | Public launch, first outreach batch |

---

## Day-by-day development

### Day 0 — Compliance (no code)
- [x] Send Verchool notification ([verchool-notification.md](verchool-notification.md))
- [x] Create GitHub repo (public)
- [x] Scaffold: Next.js App Router, Prisma, Neon, Firebase Auth
- [x] **Post:** None

### Day 1 — Auth + profile
- [x] Firebase Auth (Google + email)
- [x] User profile: display name, slug (`/s/kartik`)
- [x] Empty dashboard shell
- [ ] **Post:** Announce problem (see calendar)

### Day 2 — Daily schedule
- [x] Set work start / end for today
- [x] Optional lunch window (start/end)
- [x] Save to DB (Prisma: `User`, `DaySchedule`)
- [x] **Post:** Pain post — family interruptions (posted 2026-08-04 on X)

### Day 3 — Status toggle
- [x] Status enum: `available` | `focused` | `in_meeting` | `off_clock`
- [x] Optional "until" time + short message
- [x] Dashboard: big status buttons
- [ ] **Post:** Screenshot of dashboard (early UI OK)

### Day 4 — Public share page (hero)
- [x] `/s/[slug]` — read-only, no auth, mobile-first
- [x] Shows: name, work hours, current status, message, lunch window
- [x] Auto-refresh or 30s polling (no WebSocket v1)
- [x] Public repo + README
- [ ] **Post:** Share page on phone mockup

### Day 5 — Share link + QR
- [x] Copy link button on dashboard
- [x] QR code generator (client-side `qrcode` package) for "stick on fridge"
- [ ] **Post:** "Kitchen tablet test" — partner opens link
- [x] **LinkedIn:** First-ever post for this project — Days 1–5 catch-up announcement + screenshots, published 2026-08-10

### Day 6 — Shutdown ritual (step 1–3)
- [ ] Modal/wizard: capture loose thought → tomorrow top 3 → confirm tomorrow hours
- [ ] **Post:** Cal Newport shutdown angle (human, not preachy)

### Day 7 — Shutdown complete
- [ ] Final step: "Off the clock" → status `off_clock`, hide meeting blocks
- [ ] Shutdown timestamp logged
- [ ] **Post:** Week 1 recap GIF (toggle status → share page updates)

### Day 8 — Recurring schedule (Pro preview)
- [ ] Default weekly template (Mon–Fri 9–6) — stored on user
- [ ] "Apply to today" one tap
- [ ] **Post:** LinkedIn week 1 story

### Day 9 — Landing page
- [ ] Hero: one-liner + demo screenshot + "Get free link"
- [ ] 3 pain bullets (interruptions, Slack invisible to family, no commute)
- [ ] **Post:** Landing page link (soft launch)

### Day 10 — Stripe + Pro tier
- [ ] Pro $6/mo: recurring schedule, custom footer message, shutdown streak
- [ ] Free: 1 slug, manual daily setup, basic shutdown
- [ ] **Post:** Pricing transparency thread

### Day 11 — Polish + accessibility
- [ ] Share page: large type, high contrast, status colors (not color-only — icons + labels)
- [ ] Dark mode on share page
- [ ] **Post:** Before/after UI polish

### Day 12 — Bug bash + unslop
- [ ] Mobile test on real phone + old tablet
- [ ] Run README and all posts through unslop
- [ ] **Post:** "Launching in 48 hours"

### Day 13 — LAUNCH
- [ ] Production deploy (Vercel)
- [ ] Product Hunt optional (skip if tired)
- [ ] **Post:** Launch thread (X + LinkedIn)

### Day 14 — Outreach
- [ ] 10 DMs: WFH creators, remote work accounts, parent WFH posts
- [ ] 5 posts in r/telecommuting, r/WorkOnline (follow sub rules)
- [ ] **Post:** "Free link — tell me if your household gets it"

---

## v0.1 scope boundaries (YAGNI)

**In scope:**
- Manual daily schedule + status
- Public share page (no login for viewers)
- Shutdown ritual (5 min flow)
- QR code for share link
- Stripe Pro

**Out of scope v0.1:**
- Google Calendar sync
- Native mobile apps
- Team/org dashboard
- Push notifications to household
- AI anything
- Electron/desktop app

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 App Router, Tailwind, shadcn/ui |
| Auth | Firebase Auth |
| DB | Prisma + Neon Postgres |
| Hosting | Vercel |
| Payments | Stripe |
| Email (v1.1) | Resend for shutdown reminder to self |

---

## Success metrics (Day 14)

| Metric | Target |
|--------|--------|
| Signups | 30+ |
| Active share pages (viewed 1+ time) | 15+ |
| Paying Pro | 0–3 (bonus) |
| Inbound DMs | 5+ |
| Freelance inquiry | 1+ |

---

## After Day 14

| Cadence | Activity |
|---------|----------|
| 2×/week | WFH boundary tip or build log |
| 1×/week | LinkedIn story |
| 1×/week | Outreach (5 prospects — remote teams for Team tier) |

**v1.1 (post-launch):** Google Calendar read-only sync, email "time to shut down" nudge
