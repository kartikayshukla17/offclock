/* Hallmark · app component · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

export function ShareLinkBanner({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrPanelId = useId();

  useEffect(() => {
    if (!showQr || qrDataUrl || qrError) return;

    let cancelled = false;

    async function generate() {
      try {
        const { default: QRCode } = await import("qrcode");
        const absoluteUrl = new URL(shareUrl, window.location.origin).href;
        const dataUrl = await QRCode.toDataURL(absoluteUrl, { width: 200 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrError("Couldn't generate QR code.");
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [showQr, qrDataUrl, qrError, shareUrl]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    setCopyError(null);
    try {
      const absoluteUrl = new URL(shareUrl, window.location.origin).href;
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Couldn't copy — select and copy the link manually.");
    }
  }

  function toggleQr() {
    setShowQr((v) => {
      const next = !v;
      if (next) setQrError(null);
      return next;
    });
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
        <button
          type="button"
          aria-expanded={showQr}
          aria-controls={qrPanelId}
          onClick={toggleQr}
          className="focus-ring rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
        >
          {showQr ? "Hide QR code" : "Show QR code"}
        </button>
      </div>

      {copyError && <p className="mt-2 text-sm text-danger">{copyError}</p>}

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
    </div>
  );
}
