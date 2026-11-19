import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { VenueBadge } from "@/components/calendar/venue-badge";
import { requireRole } from "@/lib/auth";
import { shortDate } from "@/lib/dates";
import { clock, money } from "@/lib/format";
import { ALL_OCCASIONS, OCCASION_LABELS, STYLE_LABELS, WEEKDAY_NAMES, type PartyStyle } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  addVenue,
  saveClientMessages,
  saveContractTerms,
  saveGeneral,
  saveProfile,
  saveStaffingTax,
  saveEventTypes,
  saveHolidayPricing,
  saveReminder,
  saveSlot,
  saveVenue,
  sendClientMessageTest,
} from "./actions";
import { HOLIDAY_OPTIONS } from "@/lib/holiday-pricing";
import { PLACEHOLDERS, displayPhone } from "@/lib/client-messages";
import { sendingNumber } from "@/lib/client-messages-send";
import { TestReminderButton } from "./test-reminder";
import { channelSetup, prepareReminder } from "@/lib/reminder-send";

export const metadata: Metadata = { title: "Settings" };

const hhmm = (m: number | null) =>
  m === null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dollars = (c: number) => String(c / 100);
const STYLES: PartyStyle[] = ["plated", "family", "buffet", "bris"];
const KIND_LABELS = { event_space: "Event space", catering: "Outside catering", other: "Other location" } as const;

function Check({ name, value, checked, label }: { name: string; value?: string; checked: boolean; label: string }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="h-4 w-4 accent-[var(--brand)]"
      />
      {label}
    </label>
  );
}

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type SlotRow = Database["public"]["Tables"]["slots"]["Row"];

function VenueFields({ v, slotList }: { v?: VenueRow; slotList: SlotRow[] }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_5rem_4rem] gap-2">
        <label className="field">
          Name
          <input className="input" name="name" defaultValue={v?.name} />
        </label>
        <label className="field">
          Letter
          <input className="input uppercase" name="code" maxLength={2} defaultValue={v?.code} />
        </label>
        <label className="field">
          Color
          <input className="input h-11 p-1" type="color" name="color" defaultValue={v?.color ?? "#3A7CA5"} />
        </label>
      </div>
      {v?.kind !== "other" ? (
        <label className="field">
          Extra fee for this venue ($)
          <input className="input" name="fee" inputMode="decimal" defaultValue={dollars(v?.extra_fee_cents ?? 0)} />
        </label>
      ) : (
        <p className="m-0 text-sm text-muted">The fee for other locations is entered on each booking.</p>
      )}
      <fieldset>
        <legend className="mb-1.5 text-sm text-muted">Times of day it takes</legend>
        <input type="hidden" name="allSlotCount" value={slotList.length} />
        <div className="flex flex-wrap gap-1.5">
          {slotList.map((s) => (
            <Check
              key={s.id}
              name="slots"
              value={s.key}
              checked={!v?.slot_keys || v.slot_keys.includes(s.key)}
              label={s.label}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

export default async function SettingsPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const [{ data: org }, { data: venues }, { data: slots }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", me.orgId).single(),
    supabase.from("venues").select("*").order("sort_order"),
    supabase.from("slots").select("*").order("sort_order"),
  ]);
  if (!org) return null;
  const slotList = slots ?? [];
  const setupStatus = channelSetup();
  const sendingNumberNow = sendingNumber();
  const msgNumberOk = Boolean(sendingNumberNow && org.client_msgs_confirmed_number === sendingNumberNow);
  const preview = (await prepareReminder(supabase, me.orgId)).reminder;
  const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;

  return (
    <div className="grid gap-4">
      <section className="panel grid gap-3" aria-labelledby="general">
        <h2 id="general" className="text-xl font-bold">
          General
        </h2>
        <ActionForm action={saveGeneral} submitLabel="Save">
          <label className="field">
            Business name
            <input className="input" name="name" defaultValue={org.name} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              Unpaid holds turn urgent after (hours)
              <input className="input" name="holdHours" inputMode="numeric" defaultValue={org.hold_hours} />
            </label>
            <label className="field">
              Deposit ($)
              <input className="input" name="deposit" inputMode="decimal" defaultValue={dollars(org.deposit_cents)} />
            </label>
            <label className="field">
              Guest count and menu due (days before the party)
              <input className="input" name="finalDays" inputMode="numeric" defaultValue={org.final_days} />
            </label>
            <label className="field">
              Unsigned contract is urgent after (days from deposit)
              <input className="input" name="contractDays" inputMode="numeric" defaultValue={org.contract_days} />
            </label>
          </div>
          <p className="m-0 text-sm text-muted">Times are New York time ({org.timezone}).</p>
        </ActionForm>
      </section>

      <section className="panel grid gap-3" aria-labelledby="profile">
        <h2 id="profile" className="text-xl font-bold">
          Business profile
        </h2>
        <p className="m-0 text-sm text-muted">Shown at the top of every screen, on the sign-in page, on contracts, and on reports.</p>
        <ActionForm action={saveProfile} submitLabel="Save profile">
          <label className="field">
            Tagline
            <input className="input" name="tagline" maxLength={120} defaultValue={org.tagline ?? ""} placeholder="Kosher catering for every simcha" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="field">
              Phone
              <input className="input" name="phone" type="tel" maxLength={40} defaultValue={org.phone ?? ""} />
            </label>
            <label className="field">
              Email
              <input className="input" name="email" type="email" maxLength={120} defaultValue={org.email ?? ""} />
            </label>
            <label className="field">
              Website
              <input className="input" name="website" maxLength={120} defaultValue={org.website ?? ""} />
            </label>
            <label className="field">
              Brand color
              <input className="input h-11 p-1" name="brandColor" type="color" defaultValue={org.brand_color} />
            </label>
          </div>
          <label className="field">
            Address
            <input className="input" name="address" maxLength={200} defaultValue={org.address ?? ""} />
          </label>
        </ActionForm>
      </section>

      <section className="panel grid gap-3" aria-labelledby="staffing">
        <h2 id="staffing" className="text-xl font-bold">
          Waiters and sales tax
        </h2>
        <ActionForm action={saveStaffingTax} submitLabel="Save">
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              Price per waiter ($)
              <input className="input" name="waiterRate" inputMode="decimal" defaultValue={dollars(org.waiter_rate_cents)} />
            </label>
            <label className="field">
              Hours included
              <input className="input" name="waiterHours" inputMode="numeric" defaultValue={org.waiter_hours_included} />
            </label>
            <label className="field">
              Each extra hour, per waiter ($)
              <input
                className="input"
                name="waiterExtraHour"
                inputMode="decimal"
                placeholder="Not charged"
                defaultValue={org.waiter_extra_hour_cents === null ? "" : dollars(org.waiter_extra_hour_cents)}
              />
            </label>
            <label className="field">
              Minimum waiters
              <input className="input" name="waiterMin" inputMode="numeric" defaultValue={org.waiter_min} />
            </label>
            <label className="field">
              Sales tax (%)
              <input className="input" name="salesTax" inputMode="decimal" defaultValue={Number(org.sales_tax_percent)} />
            </label>
          </div>
          <p className="m-0 text-sm text-muted">
            Set the waiter price to 0 if you don&rsquo;t send waiters. Sales tax is added to food, waiters, and delivery.
          </p>
        </ActionForm>
      </section>

      <section className="panel grid gap-3" aria-labelledby="event-types">
        <h2 id="event-types" className="text-xl font-bold">
          Event types
        </h2>
        <p className="m-0 text-sm text-muted">The types of party offered in the booking form. &ldquo;Other&rdquo; is always there.</p>
        <ActionForm action={saveEventTypes} submitLabel="Save event types">
          <div className="grid gap-1 sm:grid-cols-2">
            {ALL_OCCASIONS.filter((o) => o !== "other").map((o) => (
              <label key={o} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  name="occasion"
                  value={o}
                  defaultChecked={org.occasions.includes(o)}
                  className="h-5 w-5 accent-[var(--brand)]"
                />
                {OCCASION_LABELS[o]}
              </label>
            ))}
          </div>
        </ActionForm>
      </section>

      <section className="panel grid gap-3" aria-labelledby="client-messages">
        <h2 id="client-messages" className="text-xl font-bold">
          WhatsApp messages to clients
        </h2>
        <p className={`m-0 text-sm ${org.client_msgs_enabled && msgNumberOk ? "" : "box box-warn"}`} role="status">
          {!sendingNumberNow
            ? "WhatsApp isn’t connected on the server, so nothing can be sent."
            : org.client_msgs_enabled && msgNumberOk
              ? `On. Messages go out from ${displayPhone(sendingNumberNow)} at ${hourLabel(org.client_msg_hour)}.`
              : org.client_msgs_enabled
                ? `Paused: the sending number changed to ${displayPhone(sendingNumberNow)}. Confirm it below to turn messages back on.`
                : "Off. Nothing is sent to clients until you confirm the number and turn messages on."}
        </p>
        <ActionForm action={saveClientMessages} submitLabel="Save client messages">
          {sendingNumberNow ? (
            <label className="flex min-h-11 items-start gap-2">
              <input
                type="checkbox"
                name="confirm"
                defaultChecked={msgNumberOk}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
              />
              <span>
                Messages are sent from <strong>{displayPhone(sendingNumberNow)}</strong>. This is our WhatsApp number.
              </span>
            </label>
          ) : null}
          <label className="flex min-h-11 items-center gap-2 font-semibold">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={org.client_msgs_enabled}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            Send messages to clients automatically
          </label>
          <label className="field max-w-60">
            Send at (New York time)
            <select className="input" name="hour" defaultValue={org.client_msg_hour}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="grid gap-2 rounded-xl border border-line p-3">
            <legend className="px-1 font-semibold">Before the party: guest count and menu</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="beforeOn" defaultChecked={org.client_before_enabled} className="h-5 w-5 accent-[var(--brand)]" />
              Send this message
            </label>
            <label className="field max-w-48">
              Days before the party
              <input className="input" name="beforeDays" inputMode="numeric" defaultValue={org.client_before_days} />
            </label>
            <label className="field">
              Message
              <textarea className="input min-h-28" name="beforeText" defaultValue={org.client_before_text} />
            </label>
            <p className="m-0 text-xs text-muted">Booked parties that aren’t finalized yet, each once.</p>
          </fieldset>
          <fieldset className="grid gap-2 rounded-xl border border-line p-3">
            <legend className="px-1 font-semibold">The day after the party: thank you</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="afterOn" defaultChecked={org.client_after_enabled} className="h-5 w-5 accent-[var(--brand)]" />
              Send this message
            </label>
            <label className="field">
              Message
              <textarea className="input min-h-24" name="afterText" defaultValue={org.client_after_text} />
            </label>
          </fieldset>
          <details className="text-sm">
            <summary className="cursor-pointer">Words you can use in the messages</summary>
            <ul className="mt-1 mb-0">
              {PLACEHOLDERS.map((p) => (
                <li key={p.key}>
                  <code>{p.key}</code>: {p.meaning}
                </li>
              ))}
            </ul>
          </details>
        </ActionForm>
        {sendingNumberNow ? (
          <ActionForm action={sendClientMessageTest} submitLabel="Send a test" className="grid gap-2 border-t border-line pt-3">
            <label className="field max-w-72">
              Send the “before” message as a test to
              <input className="input" name="to" type="tel" placeholder="732 555 0100" />
            </label>
          </ActionForm>
        ) : null}
      </section>

      <section className="panel grid gap-3" aria-labelledby="holiday-pricing">
        <h2 id="holiday-pricing" className="text-xl font-bold">
          Holiday pricing
        </h2>
        <p className="m-0 text-sm text-muted">
          Optional. Used in the estimate, the party total, and the contract. Leave everything off if prices don&rsquo;t change on holidays.
        </p>
        <ActionForm action={saveHolidayPricing} submitLabel="Save holiday pricing">
          <label className="field max-w-48">
            Holiday gratuity (%)
            <input
              className="input"
              name="gratuity"
              inputMode="decimal"
              defaultValue={String(Number(org.holiday_gratuity_percent))}
            />
          </label>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm text-muted">On these holidays (and the weekday they’re observed)</legend>
            <div className="flex flex-wrap gap-1.5">
              {HOLIDAY_OPTIONS.map((o) => (
                <Check
                  key={o.key}
                  name="holiday"
                  value={o.key}
                  checked={org.holiday_gratuity_days.includes(o.key)}
                  label={o.label}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm text-muted">Chanukah price per person ($, leave blank for the regular price)</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["plated", "family", "buffet"] as const).map((st) => {
                const cents = Number((org.chanukah_prices as Record<string, unknown> | null)?.[st]) || 0;
                return (
                  <label key={st} className="field">
                    {STYLE_LABELS[st]}
                    <input
                      className="input"
                      name={`chanukah_${st}`}
                      inputMode="decimal"
                      defaultValue={cents ? String(cents / 100) : ""}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
        </ActionForm>
      </section>

      <section className="panel grid gap-3" aria-labelledby="reminder">
        <h2 id="reminder" className="text-xl font-bold">
          Daily reminder
        </h2>
        <p className="m-0 text-sm text-muted">
          Once a day: what needs attention (urgent first) and the parties today and tomorrow.
        </p>
        <ul className="m-0 grid list-none gap-1 p-0 text-sm">
          <li>
            <strong>Email:</strong>{" "}
            {setupStatus.email ? "connected." : "not connected yet. It needs a domain and an email service account."}
          </li>
          <li>
            <strong>WhatsApp:</strong> {setupStatus.whatsapp ? "connected." : "not connected yet. It needs the Periskope API key."}
          </li>
        </ul>
        <p className={`m-0 text-sm ${org.reminder_enabled ? "" : "box box-warn"}`} role="status">
          {org.reminder_enabled
            ? `Daily sending is on, at ${hourLabel(org.reminder_hour)}. Last sent automatically: ${
                org.last_reminder_on ? shortDate(org.last_reminder_on) : "not yet"
              }.`
            : "Daily sending is off. Tick “Send the daily reminder” and save to turn it on. (A test send doesn’t turn it on.)"}
        </p>
        <ActionForm action={saveReminder} submitLabel="Save reminder settings">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={org.reminder_enabled}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            Send the daily reminder
          </label>
          <label className="field">
            Send at (New York time)
            <select className="input" name="hour" defaultValue={org.reminder_hour}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Email to (separate addresses with commas)
            <input className="input" name="emails" defaultValue={org.reminder_emails.join(", ")} />
          </label>
          <label className="field">
            WhatsApp to (number with country code, or a group id)
            <input className="input" name="whatsapp" defaultValue={org.reminder_whatsapp ?? ""} placeholder="1 732 555 0100" />
          </label>
        </ActionForm>
        <TestReminderButton />
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer font-semibold">Preview today&rsquo;s reminder</summary>
          <p className="mt-2 mb-1 text-sm text-muted">Subject: {preview.subject}</p>
          <pre className="m-0 text-sm whitespace-pre-wrap">{preview.text}</pre>
        </details>
      </section>

      <section className="panel grid gap-3" aria-labelledby="contract">
        <h2 id="contract" className="text-xl font-bold">
          Contract terms
        </h2>
        <p className="m-0 text-sm text-muted">
          Printed on every contract after the client, guest count, menu, and estimate. Put a heading in capitals on its
          own line, with a blank line between sections. Have the owner check the wording.
        </p>
        <ActionForm action={saveContractTerms} submitLabel="Save terms">
          <label className="field">
            Terms
            <textarea className="input min-h-96 text-sm" name="terms" defaultValue={org.contract_terms ?? ""} />
          </label>
        </ActionForm>
      </section>

      <section className="panel grid gap-3" aria-labelledby="venues">
        <h2 id="venues" className="text-xl font-bold">
          Venues
        </h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {(venues ?? []).map((v) => (
            <li key={v.id} className="rounded-xl border border-line">
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 py-2">
                  <span className={`flex items-center gap-2 font-semibold ${v.active ? "" : "text-muted line-through"}`}>
                    <VenueBadge venue={v} />
                    {v.name}
                  </span>
                  <span className="text-sm text-muted">
                    {!v.active
                      ? "Off"
                      : `${KIND_LABELS[v.kind]}${v.extra_fee_cents ? ` · +${money(v.extra_fee_cents)}` : ""}`}
                  </span>
                </summary>
                <ActionForm action={saveVenue} submitLabel="Save venue" className="grid gap-3 px-3 pb-3">
                  <input type="hidden" name="id" value={v.id} />
                  <VenueFields v={v} slotList={slotList} />
                  <p className="m-0 text-sm text-muted">
                    {v.exclusive
                      ? "One party per time of day here."
                      : "Several bookings can share a time of day here."}
                  </p>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={v.active}
                      className="h-5 w-5 accent-[var(--brand)]"
                    />
                    Offered for new bookings
                  </label>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
        <details className="rounded-xl border border-dashed border-line p-3">
          <summary className="cursor-pointer font-semibold text-brand">+ Add a venue</summary>
          <ActionForm action={addVenue} submitLabel="Add venue" resetOnSuccess className="mt-3 grid gap-3">
            <label className="field">
              Kind
              <select className="input" name="kind" defaultValue="event_space">
                <option value="event_space">Event space (one party per time of day)</option>
                <option value="catering">Outside catering (one job per time of day)</option>
                <option value="other">Other location (name and fee typed per booking)</option>
              </select>
            </label>
            <VenueFields slotList={slotList} />
          </ActionForm>
        </details>
      </section>

      <section className="panel grid gap-3" aria-labelledby="times">
        <h2 id="times" className="text-xl font-bold">
          Times of day
        </h2>
        <p className="m-0 text-sm text-muted">
          Changes apply to new bookings and to bookings whose date or time is changed. Existing parties are not
          affected.
        </p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {slotList.map((s) => (
            <li key={s.id} className="rounded-xl border border-line">
              <details>
                <summary className="flex min-h-12 cursor-pointer flex-wrap items-center justify-between gap-x-3 px-3 py-2">
                  <span className={`font-semibold ${s.active ? "" : "text-muted line-through"}`}>{s.label}</span>
                  <span className="text-sm text-muted">
                    {s.active
                      ? `${clock(s.start_earliest)}${s.start_latest !== s.start_earliest ? `–${clock(s.start_latest)}` : ""} start${
                          s.end_latest ? `, done by ${clock(s.end_latest)}` : ""
                        }`
                      : "Off"}
                  </span>
                </summary>
                <ActionForm action={saveSlot} submitLabel="Save time of day" className="grid gap-3 px-3 pb-3">
                  <input type="hidden" name="id" value={s.id} />
                  <label className="field">
                    Name
                    <input className="input" name="label" defaultValue={s.label} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="field">
                      Earliest start
                      <input className="input" type="time" step={900} name="earliest" defaultValue={hhmm(s.start_earliest)} />
                    </label>
                    <label className="field">
                      Latest start
                      <input className="input" type="time" step={900} name="latest" defaultValue={hhmm(s.start_latest)} />
                    </label>
                    <label className="field">
                      Must finish by (optional)
                      <input className="input" type="time" step={900} name="endBy" defaultValue={hhmm(s.end_latest)} />
                    </label>
                    <label className="field">
                      Longest party (hours)
                      <input className="input" name="maxHours" inputMode="decimal" defaultValue={s.max_minutes / 60} />
                    </label>
                    <label className="field">
                      Guest limit (optional)
                      <input className="input" name="maxGuests" inputMode="numeric" defaultValue={s.max_guests ?? ""} />
                    </label>
                  </div>
                  <fieldset>
                    <legend className="mb-1.5 text-sm text-muted">Days of the week</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_NAMES.map((d, i) => (
                        <Check key={d} name="weekdays" value={String(i)} checked={s.weekdays.includes(i)} label={d.slice(0, 3)} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-1.5 text-sm text-muted">Only in the winter (standard time) on</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_NAMES.map((d, i) => (
                        <Check
                          key={d}
                          name="winterOnly"
                          value={String(i)}
                          checked={s.standard_time_only_weekdays.includes(i)}
                          label={d.slice(0, 3)}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-1.5 text-sm text-muted">Party styles</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLES.map((st) => (
                        <Check
                          key={st}
                          name="styles"
                          value={st}
                          checked={!s.allowed_styles || s.allowed_styles.includes(st)}
                          label={STYLE_LABELS[st]}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={s.active}
                      className="h-5 w-5 accent-[var(--brand)]"
                    />
                    Offered for new bookings
                  </label>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
