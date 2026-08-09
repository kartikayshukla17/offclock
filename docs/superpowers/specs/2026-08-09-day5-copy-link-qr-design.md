# Day 5 — Copy Link + QR Code — Design

**Date:** 2026-08-09
**Status:** Approved
**Scope:** BUILD-PLAN.md Day 5 — "Copy link button on dashboard, QR code generator for 'stick on fridge'"

## Goal

Let the signed-in user copy their household share link with one click, and
reveal a scannable QR code for it — so they can literally print/stick it on
the fridge or a kitchen tablet without retyping a URL.

## Where it lives

The existing "Your household link" banner in `dashboard-shell.tsx` (shown at
the top of `/dashboard` only) — not the "Household page" grid card in
`dashboard/page.tsx`. That card is a `<Link>` wrapping its entire surface;
nesting a copy button or QR toggle inside an `<a>` is invalid HTML (nested
interactive elements) and would make every click both copy/toggle AND
navigate. The banner is a plain `<div>`, the correct container for multiple
independent interactive elements.

The banner currently lives inline inside `DashboardShell`. This task
extracts it into its own `src/components/share-link-banner.tsx` — it's
about to gain real interactive state (copied-flag, QR-visible-flag), and
`DashboardShell` should stay focused on auth/redirect/layout concerns,
matching how `DayScheduleForm` and `StatusPanel` were already extracted
out of `dashboard/page.tsx` rather than inlined.

The "Household page" grid card is unchanged — it stays a simple secondary
navigation shortcut to `/s/[slug]`.

## Copy button

`navigator.clipboard.writeText(shareUrl)`. On success, button label swaps
from "Copy link" to "Copied!" for ~2 seconds (`setTimeout`, cleared on
unmount), then reverts. No toast/popup — matches this app's established
silent-confirmation pattern (the "Saved." text used everywhere else, not a
celebratory popup for an action the user can already see worked).

`navigator.clipboard` requires a secure context (HTTPS or localhost) and can
throw (permissions, older browsers). Wrap in try/catch; on failure, show a
brief inline error ("Couldn't copy — select and copy the link manually")
rather than failing silently.

## QR code

**Library:** `qrcode` (npm, MIT, ~15KB) — generates entirely client-side,
no network call, doesn't send the household's share URL to a third-party
API, no dependency on an external service's uptime.

**Reveal, not always-on:** a "Show QR code" toggle button. The QR is
generated once, on first reveal (not on every dashboard render) — call
`QRCode.toCanvas(canvasRef.current, shareUrl, { width: 200 })` inside a
`useEffect` that only runs when the QR panel is shown and a canvas ref
exists. Toggling closed and reopening does not regenerate it. Uses the
locked design tokens for the surrounding chrome (glass card, rounded
corners) — the QR code image itself is inherently black-on-white (that's
how QR scanners expect it) and should NOT be recolored to the app's teal
accent, which would risk scan reliability.

## Error handling

- Clipboard write failure: inline error text, button reverts to "Copy
  link" (not stuck on a failed state).
- QR generation failure (`qrcode` library throws — extremely rare, but the
  library's `toCanvas` returns a promise that can reject): inline error
  text in place of the canvas, "Couldn't generate QR code."
- No `shareUrl` (user hasn't completed `/setup` yet): banner doesn't render
  at all — same guard already in place (`appUser?.slug && shareUrl`).

## Non-goals (out of scope for v0.1 / this task)

- No dedicated print stylesheet or print-optimized page — right-click-save
  the QR image or take a screenshot covers "stick on fridge."
- No QR customization (color, embedded logo) — plain black-on-white for
  maximum scan reliability.
- No "regenerate QR" action — the URL is stable per user (the slug doesn't
  change), so the QR never needs to change either.

## Testing

Same approach as every prior day (no test framework in this project):
- `npx tsc --noEmit`, `npm run lint` — must stay clean.
- Manual browser check once implemented: click "Copy link", confirm the
  clipboard actually contains the URL (paste somewhere); click "Show QR
  code", confirm a scannable QR renders (test with a phone camera if
  possible) and that it actually points at the right `/s/[slug]` URL;
  toggle closed and reopen, confirm it doesn't flicker/regenerate.

## Functionality shipped at the end of Day 5

- One-click copy of the household share link, with clear success/failure
  feedback
- A QR code for the same link, generated on-demand, that a household
  member could scan with a phone camera to open the share page directly
- Foundation for BUILD-PLAN's suggested Day 5 post ("Kitchen tablet test —
  partner opens link") — there's now a QR code to actually demo in that
  post, not just a raw URL
