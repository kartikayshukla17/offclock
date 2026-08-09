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
