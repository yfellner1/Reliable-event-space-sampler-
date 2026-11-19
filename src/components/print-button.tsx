"use client";

/** Opens the browser's print dialog (or "Save as PDF"). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className="btn print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
