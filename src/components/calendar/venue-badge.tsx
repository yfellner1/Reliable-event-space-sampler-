import type { VenueRule } from "@/lib/schedule";

/** The venue's letter on its color, so venues never depend on color alone. */
export function VenueBadge({ venue, size = "md" }: { venue: Pick<VenueRule, "code" | "color" | "name">; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-5 w-5 text-[0.7rem] rounded" : "h-7 w-7 text-sm rounded-md";
  return (
    <span
      aria-hidden
      title={venue.name}
      className={`inline-flex shrink-0 items-center justify-center font-bold text-white ${cls}`}
      style={{ background: venue.color }}
    >
      {venue.code}
    </span>
  );
}
