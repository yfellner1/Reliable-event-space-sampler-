import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadClientParty } from "@/lib/client-link";
import { longDateYear, weekday } from "@/lib/dates";
import { clock } from "@/lib/format";
import { STYLE_LABELS, venueFeeFor, venueFeeLabel } from "@/lib/schedule";
import { brandCss } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { ClientForm } from "./client-form";

export const metadata: Metadata = { title: "Your party", robots: { index: false, follow: false } };

/** The client's private page: their party, guest count, and menu. No login. */
export default async function ClientPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const party = await loadClientParty(token);
  if (!party) notFound();
  const { booking: b, setup, menu } = party;
  const venue = setup.venues.find((v) => v.id === b.venue_id);
  const slot = setup.slots.find((s) => s.id === b.slot_id);

  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <style>{brandCss(setup.org.profile.brandColor)}</style>
        <BrandMark name={setup.org.name} size={48} />
        <div>
          <p className="m-0 text-sm text-muted">{setup.org.name}</p>
          <h1 className="text-2xl font-bold">
            Your party{b.client_first_name ? `, ${b.client_first_name}` : ""}
          </h1>
        </div>
      </div>

      <section className="panel grid gap-1">
        <p className="m-0 text-lg font-semibold">{longDateYear(b.event_date)}</p>
        <p className="m-0">
          {slot?.label}, {clock(b.start_minute)} to {clock(b.start_minute + b.duration_minutes)}
        </p>
        <p className="m-0">
          {venue?.kind === "catering"
            ? (b.venue_address ?? b.other_venue_name ?? "")
            : `${b.other_venue_name ?? venue?.name} · ${STYLE_LABELS[b.party_style]}`}
        </p>
      </section>

      {party.closed ? (
        <div className="box" role="status">
          {party.closed}
        </div>
      ) : (
        <>
          <p className="m-0 text-muted">
            Please send your final guest count and menu at least a week before the party. You can come back and update
            them any time until then. We’ll review what you send.
          </p>
          {party.pending ? (
            <div className="box box-ok" role="status">
              We received your details on {longDateYear(party.pending.submitted_at.slice(0, 10))}. You can change them
              below.
            </div>
          ) : null}
          <ClientForm
            token={token}
            menu={menu}
            initial={party.current}
            pricing={{
              date: b.event_date,
              style: b.party_style,
              saturdayNight: weekday(b.event_date) === 6 && slot?.key === "evening",
              venueFeeCents: venueFeeFor(venue, b.venue_fee_cents),
              venueName: venue?.name ?? null,
              venueFeeLabel: venueFeeLabel(venue?.kind),
              waiters: b.waiters,
              durationMinutes: b.duration_minutes,
              business: setup.org.pricing,
              depositCents: b.deposit_paid ? (b.deposit_amount_cents ?? 0) : 0,
              holiday: setup.org.holidayPricing,
            }}
          />
        </>
      )}
    </main>
  );
}
