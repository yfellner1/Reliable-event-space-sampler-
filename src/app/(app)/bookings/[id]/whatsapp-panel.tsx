"use client";

import { useState } from "react";

/** Copy the booking details to paste into WhatsApp, if needed. */
export function WhatsAppPanel({ message }: { message: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setStatus("Copied. Paste it into WhatsApp.");
    } catch {
      // Clipboard blocked: show the text so it can be copied by hand.
      setShowText(true);
      setStatus("Select the text below and copy it.");
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <button type="button" className="btn btn-primary" onClick={copy}>
          Copy message
        </button>
      </div>
      {status ? (
        <p className="m-0 text-sm font-semibold" role="status">
          {status}
        </p>
      ) : null}
      {showText ? (
        <textarea
          className="input min-h-72 font-mono text-sm"
          readOnly
          value={message}
          aria-label="WhatsApp message"
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
      <p className="m-0 text-xs text-muted">Built from the saved booking. Save any changes first.</p>
    </div>
  );
}
