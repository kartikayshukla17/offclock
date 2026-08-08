# Design — OffClock

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre
Playful (post-Linear soft school). Household/family app, not B2B — glassmorphism
and soft-but-contrasty color were explicitly requested.

## Macrostructure family
- Marketing pages (`/`): **Letter** — first-person, intimate open ("Dear
  household,"), no button-in-fold, reads as a personal note from the builder.
- App pages (`/login`, `/setup`, `/dashboard`): no marketing macrostructure —
  function carries these. Glass-panel cards and forms, no hero, no enrichment.
- Content page (`/s/[slug]`): zero chrome, single glass status card — this was
  already the spec; it now gets the real glass material.

## Theme
Custom, tuned. Anchored on the app's existing brand teal rather than inventing
a new hue.

- `--color-paper`      oklch(97% 0.012 85)
- `--color-paper-2`    oklch(94% 0.014 85)
- `--color-paper-3`    oklch(90% 0.016 85)
- `--color-ink`        oklch(20% 0.012 195)
- `--color-ink-2`      oklch(38% 0.012 195)
- `--color-rule`       oklch(80% 0.014 195)
- `--color-rule-2`     oklch(86% 0.010 195)
- `--color-muted`      oklch(48% 0.012 195)
- `--color-accent`     oklch(62% 0.13 195)
- `--color-accent-ink` oklch(18% 0.03 195)
- `--color-focus`      oklch(60% 0.20 195)
- `--color-glass`      oklch(98% 0.010 85 / 0.55)
- `--color-glass-border` oklch(100% 0 0 / 0.45)
- `--color-danger`     oklch(55% 0.18 25)
- `--color-danger-bg`  oklch(95% 0.03 25)

Axes: **light / geometric-sans / chromatic-teal (~195°)**.

## Typography
- Display: Bricolage Grotesque, weight 500/700, style normal (new — matches
  the "Soft" tone-pairing's free row)
- Body: Geist, weight 400/500 (already installed via `next/font` — this
  redesign also fixes a pre-existing bug where `body` hard-coded
  `font-family: Arial, Helvetica, sans-serif` instead of using it)
- Mono: Geist Mono, weight 400 (already installed — used for time values like
  `09:00–17:00`)
- Display tracking: -0.01em
- Type scale anchor: `--text-display` = clamp(2.25rem, 5vw + 1rem, 3.5rem)

## Spacing
4-point named scale, values in `tokens.css`. Pages use named tokens
(`var(--space-md)`), never raw px/rem.

## Motion
- Easings: `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) · `--ease-in-out`
  cubic-bezier(0.65, 0, 0.35, 1)
- Reveal pattern: fade + slight rise (8px) on first paint only, no
  scroll-triggered reveals — this is a utility app, not a marketing scroll
- Reduced-motion fallback: opacity-only, ≤150ms
- Glass surfaces use `backdrop-filter: blur(20px) saturate(140%)` — no motion
  on the blur itself, it's a static material property

## Microinteractions stance
- Silent success on save (existing "Saved." text pattern) — no celebratory
  toasts
- Hover delay 800ms on tooltips (none currently used), focus delay 0ms
- Buttons: `transform: translateY(1px)` on `:active`, no bounce/overshoot
- `:focus-visible` ring uses `--color-focus` at 3px, shows instantly, never
  animated in

## CTA voice
- Primary CTA: filled `--color-accent`, `--color-accent-ink` text,
  `--radius-pill` shape, `var(--space-sm) var(--space-lg)` padding
- Secondary CTA: outline `--color-rule` border, `--color-ink` text, same
  shape/padding as primary

## Per-page allowances
- Marketing page (`/`) MAY use typographic enrichment (Tier-A CSS art at
  most) — no invented stock photos, no fake browser chrome.
- App pages MUST NOT use enrichment — function carries the page.
- `/s/[slug]` — typography + glass material only, zero chrome (no nav, no
  footer).

## What pages MUST share
- The "OffClock" wordmark treatment (Bricolage Grotesque 700).
- The teal accent and its placement (≤5% of any viewport — buttons, active
  states, one accent detail, never a wall of teal).
- The display + body font pair.
- The CTA voice (pill shape, padding rhythm).
- Glass-card material (`--color-glass` + blur) for every card/panel.

## What pages MAY differ on
- Macrostructure within the page-type family (Letter is the only marketing
  page currently; app pages vary structure per their function).
- Enrichment — marketing page only, Tier-A CSS art at most.

## Exports

### tokens.css
```css
:root {
  --color-paper:        oklch(97% 0.012 85);
  --color-paper-2:       oklch(94% 0.014 85);
  --color-paper-3:       oklch(90% 0.016 85);
  --color-ink:           oklch(20% 0.012 195);
  --color-ink-2:         oklch(38% 0.012 195);
  --color-rule:          oklch(80% 0.014 195);
  --color-rule-2:        oklch(86% 0.010 195);
  --color-muted:         oklch(48% 0.012 195);
  --color-accent:        oklch(62% 0.13 195);
  --color-accent-ink:    oklch(18% 0.03 195);
  --color-focus:         oklch(60% 0.20 195);
  --color-glass:         oklch(98% 0.010 85 / 0.55);
  --color-glass-border:  oklch(100% 0 0 / 0.45);
  --color-danger:        oklch(55% 0.18 25);
  --color-danger-bg:     oklch(95% 0.03 25);

  --font-display: "Bricolage Grotesque", ui-sans-serif, sans-serif;
  --font-body:    var(--font-geist-sans), ui-sans-serif, sans-serif;
  --font-mono:    var(--font-geist-mono), ui-monospace, monospace;

  --space-3xs: 0.25rem;  --space-2xs: 0.5rem;  --space-xs: 0.75rem;
  --space-sm:  1rem;     --space-md:  1.5rem;  --space-lg: 2rem;
  --space-xl:  3rem;     --space-2xl: 4.5rem;  --space-3xl: 7rem;

  --text-xs: 0.75rem;   --text-sm: 0.875rem;  --text-md: 1.125rem;
  --text-lg: 1.375rem;  --text-xl: 1.75rem;   --text-2xl: 2.25rem;
  --text-display: clamp(2.25rem, 5vw + 1rem, 3.5rem);
  --text-display-s: clamp(1.75rem, 3vw + 1rem, 2.5rem);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-short: 160ms; --dur-med: 220ms;

  --radius-card: 1.25rem; --radius-pill: 999px; --radius-input: 0.75rem;

  --blur-glass: 20px;
}
```

### Tailwind v4 `@theme`
```css
@theme inline {
  --color-paper:   var(--color-paper);
  --color-ink:     var(--color-ink);
  --color-accent:  var(--color-accent);
  --font-display:  var(--font-display);
  --font-body:     var(--font-body);
}
```
