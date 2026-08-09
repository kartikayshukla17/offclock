# Share Button + Copy QR Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native "Share" button (Web Share API) and a "Copy QR image" button to `ShareLinkBanner`, so the household link and its QR code can go straight into WhatsApp or any other app.

**Architecture:** Both features extend the existing `src/components/share-link-banner.tsx` — no new files. Task 1 adds the Share button plus a small `toAbsoluteUrl` helper (factored out because it's about to have a third call site). Task 2 adds the Copy QR image button inside the already-existing QR panel.

**Tech Stack:** Web Share API (`navigator.share`), Clipboard API (`navigator.clipboard.write` + `ClipboardItem`) — both browser-native, no new dependencies.

## Global Constraints

- The Share button must not render at all on browsers without `navigator.share` — feature-detect client-side after mount (never during SSR), default state `false` so nothing flashes in pre-hydration.
- `AbortError` from `navigator.share()` (user closed the sheet without picking anything) is a normal cancel, not a failure — never show an error message for it.
- Every new async browser-API call (`navigator.share`, `navigator.clipboard.write`) is wrapped in try/catch with a visible, actionable inline fallback message — no silent failures, matching the pattern already established for copy-link and QR generation.
- The "Copy QR image" button only renders once `qrDataUrl` is set — there is nothing to copy before that.
- Both new buttons reuse the existing 2-second "label swap then revert" confirmation pattern (`copied` / `"Copied!"`), each with its own ref-based pending-timeout clear so rapid re-clicks never stack timers.
- No new dependencies, no per-platform share text customization, no OG/meta tag work — see the spec's Non-goals section for the full list.

---

### Task 1: `toAbsoluteUrl` helper + Share button

**Files:**
- Modify: `src/components/share-link-banner.tsx`

**Interfaces:**
- Consumes: nothing new — same `shareUrl: string` prop already on the component.
- Produces: module-level `toAbsoluteUrl(shareUrl: string): string` — Task 2 does not need this (Task 2's copy-image button works on `qrDataUrl`, which is already absolute, generated via this same helper), but future call sites should use it instead of re-inlining `new URL(...)`.

- [ ] **Step 1: Add the `toAbsoluteUrl` helper, replacing the two existing inline URL computations**

In `src/components/share-link-banner.tsx`, add this function above the `ShareLinkBanner` component (module scope, so it doesn't close over component state and has no hook-dependency implications):

```tsx
function toAbsoluteUrl(shareUrl: string): string {
  return new URL(shareUrl, window.location.origin).href;
}
```

Then replace the two existing inline computations. First, inside the QR-generation effect's `generate` function, replace:

```tsx
        const absoluteUrl = new URL(shareUrl, window.location.origin).href;
        const dataUrl = await QRCode.toDataURL(absoluteUrl, { width: 200 });
```

with:

```tsx
        const dataUrl = await QRCode.toDataURL(toAbsoluteUrl(shareUrl), {
          width: 200,
        });
```

Second, inside `handleCopy`, replace:

```tsx
      const absoluteUrl = new URL(shareUrl, window.location.origin).href;
      await navigator.clipboard.writeText(absoluteUrl);
```

with:

```tsx
      await navigator.clipboard.writeText(toAbsoluteUrl(shareUrl));
```

- [ ] **Step 2: Add Share-button state and feature detection**

Add these two lines alongside the component's existing `useState` declarations (after `qrError`):

```tsx
  const [canShare, setCanShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
```

Add this new effect alongside the component's other `useEffect` calls:

```tsx
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);
```

- [ ] **Step 3: Add the share handler**

Add this function inside the component, alongside `handleCopy`:

```tsx
  async function handleShare() {
    setShareError(null);
    try {
      await navigator.share({ title: "OffClock", url: toAbsoluteUrl(shareUrl) });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setShareError("Couldn't open the share sheet.");
    }
  }
```

- [ ] **Step 4: Add the Share button to the render**

In the button row (`<div className="mt-3 flex flex-wrap items-center gap-2">`), add this button after the existing "Copy link" button and before the "Show/Hide QR code" button:

```tsx
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="focus-ring rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
          >
            Share
          </button>
        )}
```

Then add the error display. Change:

```tsx
      {copyError && <p className="mt-2 text-sm text-danger">{copyError}</p>}
```

to:

```tsx
      {copyError && <p className="mt-2 text-sm text-danger">{copyError}</p>}
      {shareError && <p className="mt-2 text-sm text-danger">{shareError}</p>}
```

- [ ] **Step 5: Typecheck, lint, smoke check**

Run: `npx tsc --noEmit` — expect no errors. (`navigator.share` and its `ShareData` argument type are part of TypeScript's standard DOM lib; no new type packages needed.)

Run: `npm run lint` — expect no errors.

Run `npm run dev` in the background, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard` — expect `200`. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/components/share-link-banner.tsx
git commit -m "feat: add native share button to share link banner"
```

---

### Task 2: Copy QR image button

**Files:**
- Modify: `src/components/share-link-banner.tsx`

**Interfaces:**
- Consumes: `toAbsoluteUrl` is not needed here — this task works entirely from the existing `qrDataUrl` state (already an absolute-URL-encoded data URL, produced by Task 1's generation path).
- Produces: nothing new consumed elsewhere — this is the last piece of `ShareLinkBanner` planned right now.

- [ ] **Step 1: Add copy-QR-image state**

Add these alongside the component's other `useState` declarations (after `shareError`, from Task 1):

```tsx
  const [qrCopied, setQrCopied] = useState(false);
  const [qrCopyError, setQrCopyError] = useState<string | null>(null);
```

Add this ref alongside the existing `copyTimeoutRef`:

```tsx
  const qrCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 2: Extend the unmount-cleanup effect to also clear the new timer**

Find the existing cleanup effect:

```tsx
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);
```

Replace it with:

```tsx
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (qrCopyTimeoutRef.current) clearTimeout(qrCopyTimeoutRef.current);
    };
  }, []);
```

- [ ] **Step 3: Add the copy-QR-image handler**

Add this function inside the component, alongside `handleCopy`:

```tsx
  async function handleCopyQrImage() {
    if (!qrDataUrl) return;
    setQrCopyError(null);
    try {
      const blob = await fetch(qrDataUrl).then((r) => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setQrCopied(true);
      if (qrCopyTimeoutRef.current) clearTimeout(qrCopyTimeoutRef.current);
      qrCopyTimeoutRef.current = setTimeout(() => setQrCopied(false), 2000);
    } catch {
      setQrCopyError(
        "Couldn't copy the image — right-click (or long-press) it to save or copy instead.",
      );
    }
  }
```

- [ ] **Step 4: Add the button and error message to the QR panel**

Find the current QR panel render:

```tsx
      {showQr && (
        <div id={qrPanelId} className="mt-3 inline-block rounded-card bg-white p-3">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, generated client-side, no benefit from next/image's remote-fetch optimization pipeline
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

Replace it with:

```tsx
      {showQr && (
        <div id={qrPanelId} className="mt-3 inline-block rounded-card bg-white p-3">
          {qrDataUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, generated client-side, no benefit from next/image's remote-fetch optimization pipeline */}
              <img
                src={qrDataUrl}
                alt="QR code for your household link"
                width={200}
                height={200}
              />
              <button
                type="button"
                onClick={handleCopyQrImage}
                className="focus-ring mt-2 block w-full rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
              >
                {qrCopied ? "Copied!" : "Copy image"}
              </button>
            </>
          )}
          {qrError && <p className="text-sm text-danger">{qrError}</p>}
          {qrCopyError && <p className="mt-2 text-sm text-danger">{qrCopyError}</p>}
        </div>
      )}
```

Note the eslint-disable comment changed from a `//` line comment to a `{/* */}` JSX comment — inside a `<>...</>` fragment, a bare `//` comment sits as a sibling to JSX elements and is not valid there the way it was directly inside the old single-expression conditional; the `{/* */}` form is the correct JSX comment syntax and still applies to the very next line (the `<img`) exactly as before.

- [ ] **Step 5: Typecheck, lint, smoke check**

Run: `npx tsc --noEmit` — expect no errors. (`ClipboardItem` is part of TypeScript's standard DOM lib.)

Run: `npm run lint` — expect no errors. Confirm the eslint-disable comment still suppresses the `@next/next/no-img-element` warning in its new `{/* */}` form (if it doesn't, that's a real finding — the JSX-comment form must immediately precede the `<img` line, same rule as the original `//` version).

Run `npm run dev` in the background, then `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard` — expect `200`. Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add src/components/share-link-banner.tsx
git commit -m "feat: add copy QR image button"
```

---

## After this plan

Per the design spec's Testing section, a human still needs to manually verify: the Share button opens the OS share sheet with WhatsApp listed and a cancel doesn't show an error; the Share button doesn't render on a `navigator.share`-less browser (e.g. desktop Firefox); "Copy image" produces a pasteable, scannable QR; and rapid double-clicks on "Copy image" don't revert the label early.
