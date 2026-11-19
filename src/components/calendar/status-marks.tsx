import type { CalendarEntry } from "@/lib/booking-data";

/** Small status markers: hold, deposit, contract, menu, finalized. */
export function StatusMarks({ entry }: { entry: CalendarEntry }) {
  const hold =
    entry.status === "hold" ? (
      <span className="chip border-dashed" style={{ borderColor: "var(--hold)", color: "var(--hold-ink)" }}>
        ◐ Needs deposit
      </span>
    ) : null;
  const marks: { on: boolean; label: string; icon: string }[] = [
    { on: entry.depositPaid, label: "Deposit", icon: "$" },
    { on: entry.contractSigned, label: "Contract", icon: "✎" },
    { on: entry.menu.length > 0 || Boolean(entry.menuNotes), label: "Menu", icon: "🍽" },
    { on: entry.finalConfirmed, label: "Finalized", icon: "✓" },
    ...(entry.finalPaid === undefined ? [] : [{ on: entry.finalPaid, label: "Paid in full", icon: "$$" }]),
  ];
  return (
    <span className="flex flex-wrap gap-1">
      {hold}
      {marks.map((m) => (
        <span
          key={m.label}
          className={`chip ${m.on ? "" : "text-muted line-through decoration-1 opacity-70"}`}
          title={`${m.label}: ${m.on ? "done" : "not yet"}`}
        >
          <span aria-hidden className="mr-1">
            {m.icon}
          </span>
          {m.label}
          <span className="sr-only">{m.on ? " done" : " not yet"}</span>
        </span>
      ))}
    </span>
  );
}
