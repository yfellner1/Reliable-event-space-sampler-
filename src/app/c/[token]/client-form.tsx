"use client";

import { useState, useTransition } from "react";
import { EstimateBox, MenuPicker } from "@/app/(app)/bookings/menu-picker";
import { pricedMenu, type HolidayPricing } from "@/lib/holiday-pricing";
import { estimate, hasDishes, menuProblems, type BusinessPricing, type MenuChoice, type MenuDef } from "@/lib/menu";
import type { PartyStyle } from "@/lib/schedule";
import { submitClientDetails } from "./actions";

type Props = {
  token: string;
  menu: MenuDef | null;
  initial: { men: number; women: number; children: number; choices: MenuChoice[] };
  pricing: {
    date: string;
    style: PartyStyle;
    saturdayNight: boolean;
    venueFeeCents: number;
    venueName: string | null;
    venueFeeLabel: string;
    waiters: number;
    durationMinutes: number;
    business: BusinessPricing;
    depositCents: number;
    holiday: HolidayPricing;
  };
};

function Count({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="field">
      {label}
      <input
        className="input"
        type="number"
        inputMode="numeric"
        min={0}
        max={5000}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(5000, parseInt(e.target.value, 10) || 0)))}
      />
    </label>
  );
}

export function ClientForm({ token, menu, initial, pricing }: Props) {
  const [men, setMen] = useState(initial.men);
  const [women, setWomen] = useState(initial.women);
  const [children, setChildren] = useState(initial.children);
  const [choices, setChoices] = useState<MenuChoice[]>(initial.choices);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const problems = menu ? menuProblems(menu, choices, false) : [];
  const priced = menu ? pricedMenu(menu, pricing.date, pricing.style, pricing.holiday, pricing.saturdayNight) : null;
  const est =
    priced && men + women + children > 0
      ? estimate({
          menu: priced.menu,
          notes: priced.notes,
          choices,
          men,
          women,
          children,
          saturdayNight: pricing.saturdayNight,
          venueFeeCents: pricing.venueFeeCents,
          venueName: pricing.venueName,
          venueFeeLabel: pricing.venueFeeLabel,
          waiters: pricing.waiters,
          durationMinutes: pricing.durationMinutes,
          staffing: pricing.business.staffing,
          salesTaxPercent: pricing.business.salesTaxPercent,
          depositPaidCents: pricing.depositCents,
        })
      : null;

  if (result?.ok) {
    return (
      <div className="box box-ok" role="status">
        <p className="m-0 font-semibold">Thank you! We received your details.</p>
        <p className="mt-1 mb-0">We’ll review them and contact you if anything needs a change. You can open this link again to update them.</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        start(async () => setResult(await submitClientDetails(token, { men, women, children, choices, message })));
      }}
    >
      <section className="panel grid gap-3" aria-labelledby="guests-title">
        <h2 id="guests-title" className="text-lg font-bold">
          Guest count
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Count label="Men" value={men} onChange={setMen} />
          <Count label="Women" value={women} onChange={setWomen} />
          <Count label="Children" value={children} onChange={setChildren} />
        </div>
        <p className="m-0 text-sm text-muted">Total: {men + women + children} guests</p>
      </section>

      {menu && hasDishes(menu) ? (
        <section className="panel grid gap-3" aria-labelledby="menu-title">
          <h2 id="menu-title" className="text-lg font-bold">
            Menu · {menu.name}
          </h2>
          <MenuPicker menu={menu} choices={choices} onChange={setChoices} />
        </section>
      ) : null}

      {est ? (
        <section className="panel grid gap-2" aria-labelledby="estimate-title">
          <h2 id="estimate-title" className="text-lg font-bold">
            Estimate
          </h2>
          <EstimateBox e={est} />
        </section>
      ) : null}

      <section className="panel grid gap-3">
        <label className="field">
          Anything else? (allergies, seating, questions)
          <textarea className="input min-h-24" value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} />
        </label>
        {problems.length ? (
          <div className="box box-warn" role="alert">
            {problems.join(" ")}
          </div>
        ) : null}
        {result?.error ? (
          <div className="box box-err" role="alert">
            {result.error}
          </div>
        ) : null}
        <button className="btn btn-primary justify-self-start" type="submit" disabled={pending || problems.length > 0}>
          {pending ? "Sending…" : "Send my details"}
        </button>
      </section>
    </form>
  );
}
