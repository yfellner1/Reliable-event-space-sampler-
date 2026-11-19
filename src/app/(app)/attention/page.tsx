import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { VenueBadge } from "@/components/calendar/venue-badge";
import { requireRole } from "@/lib/auth";
import type { AttentionLevel } from "@/lib/attention";
import { loadAttention, loadSetup } from "@/lib/booking-data";
import { shortDate, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { loadWaitlist } from "@/lib/waitlist-data";

export const metadata: Metadata = { title: "Needs attention" };

const LEVEL_STYLE: Record<AttentionLevel, { icon: string; color: string; label: string }> = {
  urgent: { icon: "!", color: "var(--err-ink)", label: "Urgent" },
  todo: { icon: "•", color: "var(--muted)", label: "To do" },
  ready: { icon: "✓", color: "var(--ok-ink)", label: "Ready" },
};

export default async function AttentionPage({ searchParams }: PageProps<"/attention">) {
  const me = await requireRole("admin", "editor");
  const [{ entries: all }, { venues, slots }] = await Promise.all([loadAttention(me), loadSetup(me)]);
  const setup = await loadSetup(me);
  const opened = (await loadWaitlist(await createClient(), setup, todayIn(setup.org.timeZone))).filter(
    (r) => r.openNow,
  );
  const urgentOnly = (await searchParams).show === "urgent";
  const urgentEntries = all.filter((e) => e.items.some((i) => i.level === "urgent"));
  const urgent = urgentEntries.length;
  const entries = urgentOnly ? urgentEntries : all;

  return (
    <div className="grid gap-4">
      <AutoRefresh seconds={60} />
      <section className="panel">
        <h2 className="text-xl font-bold">Needs attention</h2>
        <p className="mt-1 mb-0 text-muted">
          {all.length
            ? `${all.length} upcoming ${all.length === 1 ? "party needs" : "parties need"} something${
                urgent ? `, ${urgent} urgent` : ""
              }.`
            : "Nothing needs follow-up. Every upcoming party is on track."}
        </p>
        {all.length ? (
          <nav className="mt-3 flex gap-2" aria-label="Filter">
            <Link
              href="/attention"
              aria-current={!urgentOnly ? "page" : undefined}
              className={`chip min-h-10 px-4 no-underline ${!urgentOnly ? "bg-brand text-brand-ink" : "text-ink"}`}
            >
              All ({all.length})
            </Link>
            <Link
              href="/attention?show=urgent"
              aria-current={urgentOnly ? "page" : undefined}
              className={`chip min-h-10 px-4 no-underline ${urgentOnly ? "bg-brand text-brand-ink" : "text-ink"}`}
            >
              Urgent only ({urgent})
            </Link>
          </nav>
        ) : null}
      </section>

      {opened.length ? (
        <div className="box box-ok flex flex-wrap items-center justify-between gap-2" role="status">
          <strong>
            A date opened up: {opened.length} {opened.length === 1 ? "person is" : "people are"} on the waitlist for{" "}
            {[...new Set(opened.map((r) => shortDate(r.event_date)))].join(", ")}.
          </strong>
          <Link className="btn" href="/waitlist">
            Open the waitlist
          </Link>
        </div>
      ) : null}

      {entries.length ? (
        <ul className="m-0 grid list-none gap-3 p-0">
          {entries.map(({ booking: b, items }) => {
            const venue = venues.find((v) => v.id === b.venueId);
            const slot = slots.find((s) => s.id === b.slotId);
            const isUrgent = items.some((i) => i.level === "urgent");
            return (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className={`panel grid gap-2 text-ink no-underline ${isUrgent ? "border-[var(--err-ink)]" : ""}`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      {venue ? <VenueBadge venue={venue} /> : null}
                      {b.clientName}
                    </span>
                    <span className="text-sm text-muted">
                      {shortDate(b.date)}, {slot?.label.toLowerCase()}
                      {b.otherVenueName ? ` · ${b.otherVenueName}` : ""}
                    </span>
                  </span>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {items.map((i) => {
                      const st = LEVEL_STYLE[i.level];
                      return (
                        <li key={i.kind} className="flex gap-2 text-[0.95rem]">
                          <span
                            aria-hidden
                            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{ color: st.color, border: `1.5px solid ${st.color}` }}
                          >
                            {st.icon}
                          </span>
                          <span>
                            <span className="sr-only">{st.label}: </span>
                            {i.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <span className="text-sm font-semibold text-brand">Open booking ›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
