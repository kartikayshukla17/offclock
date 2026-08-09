/* Hallmark · app component · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

function toAbsoluteUrl(shareUrl: string): string {
  return new URL(shareUrl, window.location.origin).href;
}

export function ShareLinkBanner({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);
  const [qrCopyError, setQrCopyError] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrPanelId = useId();

  useEffect(() => {
    if (!showQr || qrDataUrl || qrError) return;

    let cancelled = false;

    async function generate() {
      try {
        const { default: QRCode } = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(toAbsoluteUrl(shareUrl), {
          width: 200,
        });
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
      if (qrCopyTimeoutRef.current) clearTimeout(qrCopyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  async function handleCopy() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(toAbsoluteUrl(shareUrl));
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Couldn't copy — select and copy the link manually.");
    }
  }

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

  async function handleShare() {
    setShareError(null);
    try {
      await navigator.share({ title: "OffClock", url: toAbsoluteUrl(shareUrl) });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setShareError("Couldn't open the share sheet.");
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
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="focus-ring rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
          >
            Share
          </button>
        )}
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
      {shareError && <p className="mt-2 text-sm text-danger">{shareError}</p>}

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
    </div>
  );
}
