# Day 5 — Copy Link + QR Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user copy their household share link with one click, and reveal a client-generated QR code for it.

**Architecture:** Extract the existing inline "Your household link" banner out of `DashboardShell` into its own `ShareLinkBanner` component, then add a copy button (Task 1) and a QR-reveal toggle backed by the `qrcode` npm package (Task 2). No backend changes — this is entirely client-side, working off the `shareUrl` the shell already computes.

**Tech Stack:** Next.js 16 App Router, React 19, `qrcode` (new dependency, client-side QR generation, no network call).

## Global Constraints

- Copy confirmation is silent text ("Copied!" for ~2s), not a toast/popup — matches this app's established "Saved." confirmation pattern everywhere else.
- QR code stays plain black-on-white — never recolored to the app's teal accent (recoloring risks scan reliability).
- QR is generated once per reveal-cycle, not regenerated on every toggle — cache the result in component state, not just guard the generation call (a naive guard-only approach can leave a blank canvas on re-reveal if the underlying DOM node was unmounted; caching the actual image data sidesteps this).
- `navigator.clipboard` calls can throw (permissions, insecure context, older browsers) — always wrapped in try/catch with a visible fallback message, never a silent failure.
- UI follows the existing Tailwind style: `rounded-card`/`rounded-pill` per design.md, glass material for the banner (unchanged from what already exists), plain white background specifically for the QR code itself (not glass — QR scanners need flat contrast, not a blurred translucent surface behind it).

---

### Task 1: Extract `ShareLinkBanner`, add copy-link button

**Files:**
- Create: `src/components/share-link-banner.tsx`
- Modify: `src/components/dashboard-shell.tsx`

**Interfaces:**
- Consumes: nothing new — `shareUrl: string` is already computed in `DashboardShell` exactly as before.
- Produces: `ShareLinkBanner` component, default export none (named export), props `{ shareUrl: string }`. Task 2 extends this same component's internals — no new prop needed for Task 2, since the QR toggle only needs `shareUrl`, which this component already receives.

- [ ] **Step 1: Create the component with the banner content moved in, plus the copy button**

Create `src/components/share-link-banner.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export function ShareLinkBanner({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleCopy() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Couldn't copy — select and copy the link manually.");
    }
  }

  return (
    <div className="mb-6 rounded-card glass px-4 py-3 text-sm text-ink">
      Your household link:{" "}
      <Link href={shareUrl} className="font-medium text-accent underline">
        {shareUrl.replace(/^https?:\/\//, "")}
      </Link>
      <span className="mt-1 block text-ink-2">
        Open it on the kitchen tablet — it updates itself.
      </span>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="focus-ring rounded-pill bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-transform duration-150 ease-out hover:scale-[1.02] active:translate-y-px"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      {copyError && <p className="mt-2 text-sm text-danger">{copyError}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `DashboardShell`, replacing the inline banner**

In `src/components/dashboard-shell.tsx`, add the import:

```tsx
import { ShareLinkBanner } from "@/components/share-link-banner";
```

Replace this block:

```tsx
        {appUser?.slug && shareUrl && pathname === "/dashboard" && (
          <div className="mb-6 rounded-card glass px-4 py-3 text-sm text-ink">
            Your household link:{" "}
            <Link
              href={shareUrl}
              className="font-medium text-accent underline"
            >
              {shareUrl.replace(/^https?:\/\//, "")}
            </Link>
            <span className="mt-1 block text-ink-2">
              Open it on the kitchen tablet — it updates itself.
            </span>
          </div>
        )}
```

with:

```tsx
        {appUser?.slug && shareUrl && pathname === "/dashboard" && (
          <ShareLinkBanner shareUrl={shareUrl} />
        )}
```

After this edit, check whether `Link` (from `next/link`) is still used elsewhere in `dashboard-shell.tsx` — it is (the "OffClock" wordmark link in the header), so keep that import. Do not remove it.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Verify the dashboard still compiles and the banner still renders**

Run: `npm run dev` (background), then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard
```

Expected: `200`. This confirms no build/runtime error — the actual authenticated banner content can't be curl-verified (client-auth-gated), so the manual browser check in Task 2's Step 4 covers the real behavior for both the copy button and the QR toggle together.

- [ ] **Step 5: Commit**

```bash
git add src/components/share-link-banner.tsx src/components/dashboard-shell.tsx
git commit -m "refactor: extract ShareLinkBanner, add copy-link button"
```

---

### Task 2: Add QR code reveal to `ShareLinkBanner`

**Files:**
- Modify: `package.json` (add `qrcode` dependency, `@types/qrcode` devDependency)
- Modify: `src/components/share-link-banner.tsx`

**Interfaces:**
- Consumes: `QRCode.toDataURL(text: string, options: { width: number }): Promise<string>` from the `qrcode` package — resolves to a `data:image/png;base64,...` URL.
- Produces: no new external interface — this is the last piece of `ShareLinkBanner`, nothing downstream depends on its internals.

- [ ] **Step 1: Add the dependency**

Run: `npm install qrcode` and `npm install --save-dev @types/qrcode`

Confirm in `package.json` afterward that `"qrcode"` appears under `"dependencies"` and `"@types/qrcode"` under `"devDependencies"`.

- [ ] **Step 2: Add the QR toggle and generation logic**

In `src/components/share-link-banner.tsx`, change the imports to:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
```

Add this state alongside the existing `copied`/`copyError` state (inside the `ShareLinkBanner` function body):

```tsx
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (!showQr || qrDataUrl || qrError) return;
    QRCode.toDataURL(shareUrl, { width: 200 })
      .then(setQrDataUrl)
      .catch(() => setQrError("Couldn't generate QR code."));
  }, [showQr, qrDataUrl, qrError, shareUrl]);
```

This generates the QR **once**: the effect only fires when `showQr` becomes `true`, and the `qrDataUrl || qrError` check in the guard means it never re-runs on a later toggle — the generated image is cached in state (not re-derived from a DOM node that could be unmounted/remounted), so hiding and re-showing the QR panel is instant and never re-invokes the library.

- [ ] **Step 3: Add the toggle button and the QR panel to the render**

In the same file, inside the `<div className="mt-3 flex flex-wrap items-center gap-2">` block (added in Task 1), add a second button right after the "Copy link" button:

```tsx
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="focus-ring rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
        >
          {showQr ? "Hide QR code" : "Show QR code"}
        </button>
```

Then, after the existing `{copyError && ...}` line, add the QR panel:

```tsx
      {showQr && (
        <div className="mt-3 inline-block rounded-card bg-white p-3">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, generated
            // client-side, no benefit from next/image's remote-fetch optimization pipeline
            <img
              src={qrDataUrl}
              alt="QR code for your household link"
              width={200}
              height={200}
            />
          )}
          {qrError && <p className="text-sm text-danger">{qrError}</p>}
        </div>
      )}
```

The QR panel uses a plain `bg-white` (not `bg-paper` or `glass`) — QR scanners need flat, maximal contrast, and this app's `--color-paper` is intentionally warm-tinted (per `design.md`'s custom palette), which would reduce contrast against the QR's pure black modules. This is a deliberate, narrow exception to the token system for this one element, not a regression — the token discipline still applies to every other color in the app.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. If `@types/qrcode` isn't picked up correctly and `QRCode.toDataURL` shows as untyped, confirm Step 1's `--save-dev` install actually landed in `package.json`.

Run: `npm run lint`
Expected: no errors — the `eslint-disable-next-line` comment in Step 3 should suppress the one expected `@next/next/no-img-element` warning; confirm no OTHER unexpected lint findings appear.

- [ ] **Step 5: Manual browser verification (cannot be performed in this environment)**

State plainly in your report that this was not performed live — no real browser is available in this environment. The full checklist a human needs to run:
1. Go to `/dashboard`, click "Copy link" — confirm the button changes to "Copied!" for about 2 seconds, then reverts. Paste somewhere (address bar, notes app) to confirm the clipboard actually contains the correct `/s/[slug]` URL.
2. Click "Show QR code" — confirm a QR code image appears within a moment. Scan it with a phone camera (or any QR reader) and confirm it opens the correct share page URL.
3. Click "Hide QR code", then "Show QR code" again — confirm the QR reappears instantly (no flicker/regeneration delay) and still shows the same, correctly-scannable code.
4. Resize the browser narrow (mobile width) — confirm the copy and QR buttons don't overlap or wrap awkwardly next to the household link text.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/share-link-banner.tsx
git commit -m "feat: add QR code reveal to share link banner"
```

---

## After this plan

Per `docs/BUILD-PLAN.md`, Day 5 also calls for a build-in-public post ("Kitchen tablet test — partner opens link") — a content task, not a code task, and one that now has an actual QR code to demo instead of just a raw URL.

Day 6 (shutdown ritual, step 1–3) is the next code task after this plan lands.
