# Share button + Copy QR image — Design

**Date:** 2026-08-09
**Status:** Approved
**Scope:** Extends Day 5's `ShareLinkBanner` with two more ways to get the household link/QR into WhatsApp (or any other app): a native OS share sheet, and a direct image copy.

## Goal

Day 5 shipped "Copy link" (text) and "Show QR code" (view-only). Neither
gets the link or the QR image into WhatsApp in one motion — the user has
to manually switch apps and paste, and there's no way to hand over the QR
as an image at all. This adds:

1. A **"Share" button** that opens the device's native share sheet
   (WhatsApp, Messages, Telegram, Mail, etc. all appear there without any
   per-app integration).
2. A **"Copy QR image" button** that copies the QR as a PNG to the
   clipboard, so it can be pasted directly into WhatsApp Web, Slack,
   Notion, or anywhere else that accepts a pasted image.

## Where it lives

Both live inside the existing `src/components/share-link-banner.tsx` —
no new component. This is the same file Day 5 already touched for
copy-link and the QR toggle; the sharing surface belongs together.

## Share button

Uses the Web Share API (`navigator.share`). Only available in secure
contexts and only on some browsers (strong support on mobile Safari/Chrome,
weak-to-absent on desktop Firefox and older browsers) — so the button is
feature-detected and simply doesn't render where unsupported, rather than
rendering a dead button. Detection happens client-side in a mount-time
`useEffect` (`navigator` doesn't exist during SSR), stored in a
`canShare` boolean state, defaulting to `false` so nothing flashes in
before hydration.

Placement: same row as the existing "Copy link" button, after it.

On click: `navigator.share({ title: "OffClock", url: <absolute URL> })`.
The absolute URL is computed the same way the existing copy-link and QR
code paths already do (`new URL(shareUrl, window.location.origin).href`)
— this third call site is the trigger to factor that one-liner into a
small local helper inside the component, rather than tripling the
duplication.

Error handling: the browser throws `AbortError` when the user closes the
share sheet without picking anything — that's a normal cancel, not a
failure, and must be silently ignored (no error message, no state change).
Any other thrown error shows a brief inline message: "Couldn't open the
share sheet."

No text field beyond `title`/`url` — the target apps generate their own
previews from the URL. No non-share fallback UI when unsupported; "Copy
link" already covers that browser population.

## Copy QR image button

Lives inside the QR panel (the one that opens via "Show QR code"),
positioned next to the QR image — there is nothing to copy until a QR
has actually been generated, so the button only renders once
`qrDataUrl` is set (reusing the QR panel's existing conditional).

Mechanism: convert the already-generated QR data URL to a PNG `Blob`
(`fetch(dataUrl).then(r => r.blob())` — works on `data:` URIs in all
browsers that would plausibly reach this code path) and write it via
`navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`.

UI feedback: same label-swap pattern as "Copy link" — "Copy image" →
"Copied!" for ~2s, using the same ref-based pending-timeout-clearing
approach already established for the copy-link timer (so rapid re-clicks
on this button don't stack timers either).

Error handling: wrapped in try/catch, covering both `ClipboardItem`
unsupported (older browsers) and permission/runtime failures uniformly.
On failure, inline message with an actionable fallback: "Couldn't copy
the image — right-click (or long-press) it to save or copy instead."

## Non-goals

- No per-platform share text/message customization (e.g. a
  WhatsApp-specific caption) — `title`/`url` only.
- No Open Graph / meta tag work for richer link previews when shared —
  unrelated to this component, a separate task if wanted later.
- No share analytics or tracking of which app the user picked.
- No fallback image-copy mechanism for browsers lacking `ClipboardItem`
  beyond the inline "right-click to save" message — asking the user to
  manually save/copy the already-visible `<img>` is sufficient; no need
  to build a custom fallback UI.

## Testing

Same approach as the rest of this project (no test framework):
- `npx tsc --noEmit`, `npm run lint` — must stay clean.
- Manual browser check once implemented (needs a human — no live browser
  in the dev environment):
  - On a phone: tap "Share," confirm the native sheet opens and WhatsApp
    is a listed target; send to a test chat; confirm the link opens.
  - Tap "Share," dismiss the sheet without picking anything — confirm no
    error message appears.
  - On desktop Firefox (or another `navigator.share`-less browser):
    confirm the "Share" button does not render at all.
  - Reveal the QR code, tap "Copy image," paste into a chat app or
    document — confirm the pasted image is a valid, scannable QR.
  - Reveal the QR code, tap "Copy image" twice quickly — confirm the
    "Copied!" label doesn't revert early from a stacked timer.

## Functionality shipped at the end of this task

- One-tap native sharing of the household link to WhatsApp or any other
  installed app, on browsers that support it.
- A pasteable QR image for apps/desktop where native sharing isn't
  available or where the image itself (not just the link) is what's
  wanted.
