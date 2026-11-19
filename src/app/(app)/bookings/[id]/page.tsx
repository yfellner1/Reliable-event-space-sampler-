import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { loadBookingMenu, loadMenuLines, loadMenus, loadSetup } from "@/lib/booking-data";
import { messageForBooking } from "@/lib/whatsapp-data";
import { dateTimeIn, longDateYear, shortDate, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { VenueBadge } from "@/components/calendar/venue-badge";
import { markNoteRead } from "../note-actions";
import { BookingForm } from "../booking-form";
import { draftFromRow } from "../draft";
import { CancelBooking, DeleteBooking, RestoreBooking } from "./booking-actions";
import { describeChange } from "./history";
import { WhatsAppPanel } from "./whatsapp-panel";
import { ContractPanel } from "./contract-panel";
import { FinalPayment } from "./final-payment";
import { FinalizedSummary } from "./finalized-summary";
import { menuFor, menuSummary } from "@/lib/menu";
import { clientLinkPath, submissionChoices } from "@/lib/client-link";
import { appUrl } from "@/lib/reminder-send";
import { ClientLinkPanel } from "./client-link-panel";
import { bookingEstimate } from "@/lib/contract-data";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: PageProps<"/bookings/[id]">) {
  const me = await requireRole("admin", "editor");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createClient();
  const [{ org, venues, slots }, { data: b }, { data: notes }, { data: history }, { data: people }, menus, menuChoices] =
    await Promise.all([
      loadSetup(me),
      supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("booking_notes")
        .select("id, body, created_at, read_at, author_id")
        .eq("booking_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_log")
        .select("id, action, actor_id, at, old_data, new_data")
        .eq("table_name", "bookings")
        .eq("row_id", id)
        .order("id", { ascending: false })
        .limit(50),
      supabase.from("profiles").select("id, display_name"),
      loadMenus(),
      loadBookingMenu(id),
    ]);
  if (!b) notFound();

  const today = todayIn(org.timeZone);
  const { data: pendingSubmission } = await supabase
    .from("client_submissions")
    .select("*")
    .eq("booking_id", b.id)
    .eq("status", "pending")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const menuLines = (await loadMenuLines([b.id])).get(b.id) ?? [];
  const message = messageForBooking(b, { org, venues, slots }, menuLines);
  const venue = venues.find((v) => v.id === b.venue_id);
  const slot = slots.find((s) => s.id === b.slot_id);
  const name = (uid: string | null) =>
    people?.find((p) => p.id === uid)?.display_name ?? (uid ? "Someone" : "Automatic");

  return (
    <div className="grid gap-4">
      <div>
        <Link href={`/?d=${b.event_date}`} className="text-sm font-semibold text-brand print:hidden">
          ‹ {longDateYear(b.event_date)}
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold">
          {venue ? <VenueBadge venue={venue} /> : null}
          {b.client_first_name} {b.client_last_name}
        </h1>
        <p className="mt-1 mb-0 text-muted">
          {slot?.label} at {b.other_venue_name ?? venue?.name}
        </p>
      </div>

      {b.status === "cancelled" ? (
        <section className="box box-warn grid gap-2">
          <strong>This booking is cancelled.</strong>
          {b.cancel_reason ? <span>Reason: {b.cancel_reason}</span> : null}
          <RestoreBooking id={b.id} />
        </section>
      ) : b.status === "hold" || b.status === "expired" ? (
        <section className="box box-warn grid gap-2">
          <span>
            <strong>Needs deposit.</strong> This hold keeps the date until you record the deposit below, or cancel it
            to free the date.
          </span>
        </section>
      ) : null}

      {notes?.length ? (
        <section className="panel grid gap-2 print:hidden">
          <h2 className="text-lg font-bold">Notes from the kitchen</h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {notes.map((n) => (
              <li key={n.id} className={`rounded-xl border p-3 ${n.read_at ? "border-line" : "border-brand bg-soft"}`}>
                <p className="m-0 whitespace-pre-wrap">{n.body}</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                  <span>
                    {name(n.author_id)}, {dateTimeIn(n.created_at, org.timeZone)}
                  </span>
                  {n.read_at ? (
                    <span>Read</span>
                  ) : (
                    <form action={markNoteRead}>
                      <input type="hidden" name="noteId" value={n.id} />
                      <input type="hidden" name="bookingId" value={b.id} />
                      <button className="btn" type="submit">
                        Mark as read
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {b.status !== "cancelled" && b.final_confirmed ? (
        <FinalizedSummary
          b={b}
          venueName={b.other_venue_name ?? venue?.name ?? ""}
          slotLabel={slot?.label ?? ""}
          menuName={menuFor(menus, b.party_style, b.occasion)?.name ?? null}
          menu={menuLines}
          estimate={bookingEstimate(b, { org, venues, slots }, menus, menuChoices)}
        />
      ) : null}

      {b.status !== "cancelled" && !b.final_confirmed ? (
        <BookingForm
          // Reload the form when the booking changes elsewhere on this page
          // (contract sent or signed copy attached), so saving it can't
          // overwrite those changes with stale values.
          key={b.updated_at}
          bookingId={b.id}
          initial={draftFromRow(b)}
          venues={venues}
          slots={slots}
          timeZone={org.timeZone}
          today={today}
          holdHours={org.holdHours}
          depositCents={org.depositCents}
          holidayPricing={org.holidayPricing}
          pricing={org.pricing}
          occasions={org.occasions}
          menus={menus}
          initialMenu={{ choices: menuChoices, notes: b.menu_notes ?? "" }}
        />
      ) : null}

      {b.status === "booked" || b.status === "hold" ? (
        <section className="panel grid gap-3 print:hidden" aria-labelledby="client-link-title">
          <h2 id="client-link-title" className="text-lg font-bold">
            Client link
          </h2>
          {b.client_before_msg_at || b.client_after_msg_at ? (
            <p className="m-0 text-sm text-muted">
              WhatsApp to the client:
              {b.client_before_msg_at ? ` guest count and menu reminder sent ${dateTimeIn(b.client_before_msg_at, org.timeZone)}.` : ""}
              {b.client_after_msg_at ? ` Thank-you sent ${dateTimeIn(b.client_after_msg_at, org.timeZone)}.` : ""}
            </p>
          ) : null}
          <ClientLinkPanel
            bookingId={b.id}
            url={b.client_token ? `${appUrl()}${clientLinkPath(b.client_token)}` : null}
            clientFirstName={b.client_first_name}
            clientPhoneDigits={b.client_phone.replace(/\D/g, "")}
            dateLabel={longDateYear(b.event_date)}
            finalized={b.final_confirmed}
            pending={
              pendingSubmission
                ? {
                    id: pendingSubmission.id,
                    sentLabel: dateTimeIn(pendingSubmission.submitted_at, org.timeZone),
                    guests: {
                      men: pendingSubmission.guests_men,
                      women: pendingSubmission.guests_women,
                      children: pendingSubmission.guests_children,
                    },
                    before: { men: b.guests_men, women: b.guests_women, children: b.guests_children },
                    menu: (() => {
                      const m = menuFor(menus, b.party_style, b.occasion);
                      return m ? menuSummary(m, submissionChoices(pendingSubmission)) : [];
                    })(),
                    message: pendingSubmission.message,
                  }
                : null
            }
          />
        </section>
      ) : null}

      {b.status === "booked" ? (
        <FinalPayment
          bookingId={b.id}
          paid={b.final_paid}
          paidOn={b.final_paid_on}
          method={b.final_paid_method}
          amountCents={b.final_paid_amount_cents}
          balanceCents={bookingEstimate(b, { org, venues, slots }, menus, menuChoices)?.balanceCents ?? null}
          today={today}
        />
      ) : null}

      <section className="panel grid gap-3 print:hidden" aria-labelledby="contract-title">
        <h2 id="contract-title" className="text-lg font-bold">
          Contract
        </h2>
        <ContractPanel
          bookingId={b.id}
          sentLabel={b.contract_sent_on ? shortDate(b.contract_sent_on) : null}
          signedLabel={b.contract_signed_on ? shortDate(b.contract_signed_on) : null}
          hasSignedCopy={Boolean(b.contract_file_path)}
          cancelled={b.status === "cancelled"}
        />
      </section>

      <section className="panel grid gap-3 print:hidden" aria-labelledby="wa-title">
        <h2 id="wa-title" className="text-lg font-bold">
          WhatsApp message
        </h2>
        <WhatsAppPanel message={message} />
      </section>

      {b.status !== "cancelled" && !b.final_confirmed ? (
        <section className="panel grid gap-3">
          <h2 className="text-lg font-bold">Cancel</h2>
          <CancelBooking id={b.id} />
        </section>
      ) : null}
      {me.role === "admin" ? <DeleteBooking id={b.id} /> : null}

      <section className="panel print:hidden">
        <h2 className="mb-2 text-lg font-bold">History</h2>
        <ul className="m-0 grid list-none gap-2 p-0 text-sm">
          {history?.map((h) => (
            <li key={h.id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
              <span className="font-semibold">
                {describeChange(
                  h.action,
                  h.old_data as Record<string, unknown> | null,
                  h.new_data as Record<string, unknown> | null,
                )}
              </span>
              <span className="block text-muted">
                {name(h.actor_id)}, {dateTimeIn(h.at, org.timeZone)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
