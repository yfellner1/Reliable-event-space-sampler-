"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormAction } from "@/components/use-form-action";
import { clock, money } from "@/lib/format";
import { shortDate, weekday, type ISODate } from "@/lib/dates";
import { estimate, hasDishes, menuFor, menuProblems, type BusinessPricing, type MenuChoice, type MenuDef } from "@/lib/menu";
import {
  PAYMENT_LABELS,
  STYLE_LABELS,
  OCCASION_LABELS,
  occasionChoices,
  feeTypedIn,
  venueFeeFor,
  venueFeeLabel,
  bookingProblems,
  guestTotal,
  hoursLabel,
  lengths,
  slotClosedReason,
  startTimes,
  stylesFor,
  venueOffersSlot,
  type BookingDraft,
  type PaymentMethod,
  type SlotRule,
  type VenueRule,
} from "@/lib/schedule";
import { VenueBadge } from "@/components/calendar/venue-badge";
import { checkAvailability, saveBooking, type FreeVenue, type SaveState } from "./actions";
import { EstimateBox, MenuPicker } from "./menu-picker";
import { CustomerLookup } from "./customer-lookup";
import { holidaysOn } from "@/lib/holidays";
import { pricedMenu, type HolidayPricing } from "@/lib/holiday-pricing";

type Props = {
  bookingId?: string;
  initial: BookingDraft;
  venues: VenueRule[];
  slots: SlotRule[];
  timeZone: string;
  today: ISODate;
  holdHours: number;
  depositCents: number;
  holidayPricing: HolidayPricing;
  menus: MenuDef[];
  pricing: BusinessPricing;
  /** The business's event types, in order. */
  occasions: string[];
  initialMenu: { choices: MenuChoice[]; notes: string };
};

type Availability = { taken: { venueId: string; status: "hold" | "booked" }[]; free: FreeVenue[] };

const dollarsToCents = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : Math.round(n * 100);
};
const centsToDollars = (c: number | null) => (c === null ? "" : String(c / 100));
const count = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function BookingForm(props: Props) {
  const { venues, slots, timeZone, today, holdHours, depositCents, bookingId } = props;
  const [d, setD] = useState<BookingDraft>(props.initial);
  const [feeText, setFeeText] = useState(centsToDollars(props.initial.venueFeeCents));
  const [depositText, setDepositText] = useState(
    centsToDollars(props.initial.depositAmountCents ?? depositCents),
  );
  const [tried, setTried] = useState(false);
  const [menuChoices, setMenuChoices] = useState<MenuChoice[]>(props.initialMenu.choices);
  const [menuNotes, setMenuNotes] = useState(props.initialMenu.notes);
  const [state, submit, pending] = useFormAction<SaveState>(saveBooking, {});
  const [avail, setAvail] = useState<Availability | null>(null);
  const [, startCheck] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof BookingDraft>(k: K, v: BookingDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const slot = slots.find((s) => s.id === d.slotId);
  const venue = venues.find((v) => v.id === d.venueId);
  const initial = props.initial;
  const timingChanged =
    !bookingId ||
    initial.venueId !== d.venueId ||
    initial.slotId !== d.slotId ||
    initial.date !== d.date ||
    initial.startMinute !== d.startMinute ||
    initial.durationMinutes !== d.durationMinutes ||
    initial.style !== d.style;

  const draft: BookingDraft = {
    ...d,
    venueFeeCents: feeTypedIn(venue?.kind) ? dollarsToCents(feeText) : null,
    depositAmountCents: d.depositPaid ? dollarsToCents(depositText) : null,
  };
  const menu = menuFor(props.menus, d.style, d.occasion);
  const menuItemIds = new Set(menu?.sections.flatMap((sec) => sec.items.map((i) => i.id)) ?? []);
  // Choices from another style's menu drop away when the style changes.
  const choices = menuChoices.filter((c) => menuItemIds.has(c.itemId));
  const problems = [
    ...bookingProblems(draft, { slot, venue, today, timeZone, checkSchedule: timingChanged }),
    ...(menu ? menuProblems(menu, choices, d.finalConfirmed && hasDishes(menu)) : []),
    ...(d.finalConfirmed && !hasDishes(menu) && !menuNotes.trim()
      ? ["Enter the menu before marking the party finalized."]
      : []),
  ];
  const saturdayNight = Boolean(d.date) && weekday(d.date) === 6 && slot?.key === "evening";
  const priced = menu ? pricedMenu(menu, d.date, d.style, props.holidayPricing, saturdayNight) : null;
  const est = priced
    ? estimate({
        menu: priced.menu,
        notes: priced.notes,
        choices,
        men: d.men,
        women: d.women,
        children: d.children,
        saturdayNight,
        venueFeeCents: venueFeeFor(venue, draft.venueFeeCents),
        venueName: venue?.name ?? null,
        venueFeeLabel: venueFeeLabel(venue?.kind),
        waiters: d.waiters,
        durationMinutes: d.durationMinutes,
        staffing: props.pricing.staffing,
        salesTaxPercent: props.pricing.salesTaxPercent,
        depositPaidCents: d.depositPaid ? (draft.depositAmountCents ?? 0) : 0,
      })
    : null;

  // Check which venues are free whenever the date or time of day changes.
  useEffect(() => {
    if (!d.date || !d.slotId) return;
    let live = true;
    startCheck(async () => {
      const r = await checkAvailability(d.date, d.slotId, bookingId);
      if (live) setAvail(r);
    });
    return () => {
      live = false;
    };
  }, [d.date, d.slotId, bookingId]);

  // Show server messages at the top of the form.
  useEffect(() => {
    if (state.errors?.length || state.conflict) topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  function chooseSlot(id: string) {
    const s = slots.find((x) => x.id === id);
    if (!s) return;
    setD((p) => {
      const style = stylesFor(s).includes(p.style) ? p.style : stylesFor(s)[0];
      const start = s.startEarliest;
      const lens = lengths(s, start);
      const duration = lens.includes(p.durationMinutes) ? p.durationMinutes : lens[lens.length - 1];
      const v = venues.find((x) => x.id === p.venueId);
      const venueId = v && venueOffersSlot(v, s) ? p.venueId : (venues.find((x) => venueOffersSlot(x, s))?.id ?? "");
      return { ...p, slotId: id, style, startMinute: start, durationMinutes: duration, venueId };
    });
  }

  /** Times of day open on the date (all of them before a date is picked). */
  const openSlots = d.date ? slots.filter((s) => !slotClosedReason(s, d.date, timeZone)) : slots;

  function chooseDate(date: string) {
    set("date", date);
    const open = date ? slots.filter((s) => !slotClosedReason(s, date, timeZone)) : slots;
    // Move to a time of day that runs on that day, when the current one doesn't.
    if (open.length && !open.some((s) => s.id === d.slotId)) chooseSlot(open[0].id);
  }

  function chooseStart(start: number) {
    if (!slot) return;
    setD((p) => {
      const lens = lengths(slot, start);
      const duration = lens.includes(p.durationMinutes) ? p.durationMinutes : lens[lens.length - 1];
      return { ...p, startMinute: start, durationMinutes: duration };
    });
  }

  const takenHere = avail?.taken.find((t) => t.venueId === d.venueId);
  const closedReason = slot && d.date ? slotClosedReason(slot, d.date, timeZone) : null;
  const total = guestTotal(d);
  const isNew = !bookingId;
  const submitLabel = d.depositPaid ? "Save booking" : isNew ? "Save as hold (needs deposit)" : "Save hold";

  const payload = JSON.stringify({ ...draft, id: bookingId, menu: { choices, notes: menuNotes } });

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        setTried(true);
        if (problems.length) {
          e.preventDefault();
          topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        submit(e);
      }}
    >
      <input type="hidden" name="payload" value={payload} />
      <div ref={topRef} className="scroll-mt-4" />

      {state.conflict ? (
        <div className="box box-err grid gap-2" role="alert">
          <strong>{state.conflict.message}</strong>
          <FreeVenueButtons free={state.conflict.freeVenues} onPick={(id) => set("venueId", id)} />
        </div>
      ) : null}
      {state.errors?.length ? (
        <div className="box box-err" role="alert">
          <ul className="m-0 pl-5">
            {state.errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {tried && problems.length && !state.errors?.length ? (
        <div className="box box-err" role="alert">
          <p className="mt-0 mb-1 font-semibold">Fix these to save:</p>
          <ul className="m-0 pl-5">
            {problems.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="panel grid gap-3">
        <h2 className="text-lg font-bold">When and where</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            Date
            <input
              className="input"
              type="date"
              value={d.date}
              min={isNew ? today : undefined}
              onChange={(e) => chooseDate(e.target.value)}
              required
            />
          </label>
          <label className="field">
            Time of day
            <select className="input" value={d.slotId} onChange={(e) => chooseSlot(e.target.value)}>
              {slots
                .filter((s) => s.id === d.slotId || openSlots.includes(s))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {openSlots.includes(s) ? "" : " (not on this day)"}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {d.date ? (
          <p className="m-0 text-sm text-muted">
            {shortDate(d.date)}
            {holidaysOn(d.date).length ? (
              <strong className="text-ink"> · {holidaysOn(d.date).map((h) => h.name).join(", ")}</strong>
            ) : null}
          </p>
        ) : null}
        {closedReason ? <div className="box box-warn">{closedReason}</div> : null}

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm text-muted">Venue</legend>
          {venues
            .filter((v) => slot && venueOffersSlot(v, slot))
            .map((v) => {
              const t = v.exclusive ? avail?.taken.find((x) => x.venueId === v.id) : undefined;
              return (
                <label
                  key={v.id}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-2.5 ${
                    d.venueId === v.id ? "border-brand bg-soft" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="venue"
                    className="h-5 w-5 accent-[var(--brand)]"
                    checked={d.venueId === v.id}
                    onChange={() => set("venueId", v.id)}
                  />
                  <VenueBadge venue={v} />
                  <span className="flex-1">
                    {v.name}
                    {v.extraFeeCents ? <span className="text-sm text-muted"> · +{money(v.extraFeeCents)}</span> : null}
                  </span>
                  {t ? (
                    <span className="chip" style={{ color: "var(--err-ink)" }}>
                      {t.status === "hold" ? "On hold" : "Booked"}
                    </span>
                  ) : v.exclusive && avail ? (
                    <span className="chip text-muted">Open</span>
                  ) : null}
                </label>
              );
            })}
        </fieldset>

        {takenHere && venue ? (
          <div className="box box-warn grid gap-2">
            <span>
              {venue.name} is already {takenHere.status === "hold" ? "on hold" : "booked"} for this slot.
            </span>
            <FreeVenueButtons
              free={avail?.free.filter((f) => f.id !== venue.id) ?? []}
              onPick={(id) => set("venueId", id)}
            />
          </div>
        ) : null}

        {feeTypedIn(venue?.kind) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">
              {venue?.kind === "catering" ? "Place name (shul, hall, or home)" : "Location name"}
              <input
                className="input"
                value={d.otherVenueName}
                onChange={(e) => set("otherVenueName", e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="field">
              {venue?.kind === "catering" ? "Delivery fee ($)" : "Extra fee for this location ($)"}
              <input
                className="input"
                inputMode="decimal"
                value={feeText}
                onChange={(e) => setFeeText(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
        ) : null}
        {venue && venue.kind !== "event_space" ? (
          <label className="field">
            {venue.kind === "catering" ? "Event address (where the food and waiters go)" : "Address"}
            <input
              className="input"
              value={d.venueAddress}
              onChange={(e) => set("venueAddress", e.target.value)}
              autoComplete="off"
            />
          </label>
        ) : null}

        {slot ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              Start time
              <select className="input" value={d.startMinute} onChange={(e) => chooseStart(Number(e.target.value))}>
                {startTimes(slot).map((m) => (
                  <option key={m} value={m}>
                    {clock(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Length
              <select
                className="input"
                value={d.durationMinutes}
                onChange={(e) => set("durationMinutes", Number(e.target.value))}
              >
                {lengths(slot, d.startMinute).map((m) => (
                  <option key={m} value={m}>
                    {hoursLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <p className="m-0 text-sm text-muted">
          {clock(d.startMinute)} to {clock(d.startMinute + d.durationMinutes)}
        </p>
      </section>

      <section className="panel grid gap-3">
        <h2 className="text-lg font-bold">Client</h2>
        {isNew ? (
          <CustomerLookup
            onPick={(c) =>
              setD((p) => ({ ...p, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email }))
            }
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            First name
            <input
              className="input"
              value={d.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="field">
            Last name
            <input
              className="input"
              value={d.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="field">
            Phone
            <input
              className="input"
              type="tel"
              value={d.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="field">
            Email (for the contract)
            <input
              className="input"
              type="email"
              value={d.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
            />
          </label>
        </div>
      </section>

      <section className="panel grid gap-3">
        <h2 className="text-lg font-bold">Party</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            Type of party
            <select
              className="input"
              value={d.occasion}
              onChange={(e) => set("occasion", e.target.value as BookingDraft["occasion"])}
            >
              <option value="">Choose…</option>
              {occasionChoices(props.occasions).map((o) => (
                <option key={o} value={o}>
                  {OCCASION_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
          {d.occasion === "other" ? (
            <label className="field">
              What kind of party?
              <input
                className="input"
                value={d.occasionOther}
                maxLength={100}
                onChange={(e) => set("occasionOther", e.target.value)}
              />
            </label>
          ) : null}
        </div>
        {slot ? (
          <fieldset>
            <legend className="mb-1.5 text-sm text-muted">Style</legend>
            <div className="flex flex-wrap gap-2">
              {stylesFor(slot).map((s) => (
                <label
                  key={s}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 ${
                    d.style === s ? "border-brand bg-soft" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="style"
                    className="h-4 w-4 accent-[var(--brand)]"
                    checked={d.style === s}
                    onChange={() => set("style", s)}
                  />
                  {STYLE_LABELS[s]}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <fieldset>
          <legend className="mb-1.5 text-sm text-muted">
            Guests{slot?.maxGuests ? ` (up to ${slot.maxGuests})` : ""}
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {(["men", "women", "children"] as const).map((k) => (
              <label key={k} className="field">
                {k[0].toUpperCase() + k.slice(1)}
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={d[k] || ""}
                  onChange={(e) => set(k, count(e.target.value))}
                />
              </label>
            ))}
          </div>
          <p className="mt-1.5 mb-0 text-sm text-muted">
            {total ? `${total} guests in total` : "Guest count not in yet"}
          </p>
        </fieldset>
        {props.pricing.staffing.rateCents ? (
          <label className="field max-w-xs">
            Waiters
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              value={d.waiters || ""}
              placeholder="0 (drop-off)"
              onChange={(e) => set("waiters", Math.min(50, count(e.target.value)))}
            />
            <span className="text-sm text-muted">
              {money(props.pricing.staffing.rateCents)} each, up to {props.pricing.staffing.hoursIncluded} hours
              {props.pricing.staffing.min ? ` · minimum ${props.pricing.staffing.min} when waiters are sent` : ""}
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-x-6">
          <Check label="Head table needed" checked={d.headTable} onChange={(on) => set("headTable", on)} />
          <Check label="Mechitza (divider) needed" checked={d.mechitza} onChange={(on) => set("mechitza", on)} />
        </div>
        <label className="field">
          Notes and upgrades
          <textarea className="input min-h-20" value={d.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>
      </section>

      <section className="panel grid gap-3" aria-labelledby="menu-title">
        <h2 id="menu-title" className="text-lg font-bold">
          Menu{menu ? ` · ${menu.name}` : ""}
        </h2>
        {menu && hasDishes(menu) ? (
          <MenuPicker menu={menu} choices={choices} onChange={setMenuChoices} />
        ) : (
          <p className="m-0 text-sm text-muted">
            The {menu?.name ?? "menu"} dishes aren&rsquo;t set up yet. Write the menu in the notes below for now.
          </p>
        )}
        <label className="field">
          Menu notes (allergies, changes, anything the kitchen should know)
          <textarea className="input min-h-20" value={menuNotes} onChange={(e) => setMenuNotes(e.target.value)} />
        </label>
      </section>

      {est && menu ? (
        <section className="panel grid gap-3" aria-labelledby="estimate-title">
          <h2 id="estimate-title" className="text-lg font-bold">
            Estimate
          </h2>
          <EstimateBox e={est} />
        </section>
      ) : null}

      <section className="panel grid gap-3">
        <h2 className="text-lg font-bold">Progress</h2>

        <Check
          label="Deposit paid"
          checked={d.depositPaid}
          onChange={(on) =>
            setD((p) => ({ ...p, depositPaid: on, depositReceivedOn: on && !p.depositReceivedOn ? today : p.depositReceivedOn }))
          }
        />
        {d.depositPaid ? (
          <div className="grid gap-3 rounded-xl bg-soft p-3">
            <fieldset>
              <legend className="mb-1.5 text-sm text-muted">Paid by</legend>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                  <label
                    key={m}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-surface px-3 ${
                      d.depositMethod === m ? "border-brand" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="depositMethod"
                      className="h-4 w-4 accent-[var(--brand)]"
                      checked={d.depositMethod === m}
                      onChange={() => set("depositMethod", m)}
                    />
                    {PAYMENT_LABELS[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                Amount ($)
                <input
                  className="input"
                  inputMode="decimal"
                  value={depositText}
                  onChange={(e) => setDepositText(e.target.value)}
                />
              </label>
              <label className="field">
                Received on
                <input
                  className="input"
                  type="date"
                  value={d.depositReceivedOn}
                  onChange={(e) => set("depositReceivedOn", e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}

        <label className="field">
          Contract sent on
          <input
            className="input"
            type="date"
            value={d.contractSentOn}
            onChange={(e) => set("contractSentOn", e.target.value)}
          />
        </label>
        <Check
          label="Contract signed"
          checked={Boolean(d.contractSignedOn)}
          onChange={(on) => set("contractSignedOn", on ? d.contractSignedOn || today : "")}
        />
        {d.contractSignedOn ? (
          <label className="field">
            Signed on
            <input
              className="input"
              type="date"
              value={d.contractSignedOn}
              onChange={(e) => set("contractSignedOn", e.target.value || today)}
            />
          </label>
        ) : null}

        <Check label="Party finalized" checked={d.finalConfirmed} onChange={(on) => set("finalConfirmed", on)} />
        <p className="m-0 text-sm text-muted">
          Tick once the guest count and menu are complete. The booking then shows a clean summary; untick it to make
          changes.
        </p>
        {!d.depositPaid ? (
          <p className="m-0 text-sm text-muted">
            Without a deposit this is a hold: it keeps the date and shows as “Needs deposit” until you record the
            deposit or cancel it. After {holdHours} hours it turns urgent in Needs attention.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <a className="btn" href={d.date ? `/?d=${d.date}` : "/"}>
          Back to calendar
        </a>
      </div>
    </form>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
      <input
        type="checkbox"
        className="h-5 w-5 accent-[var(--brand)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function FreeVenueButtons({ free, onPick }: { free: FreeVenue[]; onPick: (id: string) => void }) {
  if (!free.length) return <span>No other venue is free at that time. Try another slot or date.</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>Open instead:</span>
      {free.map((f) => (
        <button key={f.id} type="button" className="btn" onClick={() => onPick(f.id)}>
          Use {f.name}
          {f.feeCents ? ` (+${money(f.feeCents)})` : ""}
        </button>
      ))}
    </span>
  );
}
