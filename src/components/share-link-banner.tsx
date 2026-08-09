"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

export function ShareLinkBanner({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (!showQr || qrDataUrl || qrError) return;
    QRCode.toDataURL(shareUrl, { width: 200 })
      .then(setQrDataUrl)
      .catch(() => setQrError("Couldn't generate QR code."));
  }, [showQr, qrDataUrl, qrError, shareUrl]);

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
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="focus-ring rounded-pill border border-rule px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors duration-150 ease-out hover:bg-paper-2"
        >
          {showQr ? "Hide QR code" : "Show QR code"}
        </button>
      </div>

      {copyError && <p className="mt-2 text-sm text-danger">{copyError}</p>}

      {showQr && (
        <div className="mt-3 inline-block rounded-card bg-white p-3">
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
