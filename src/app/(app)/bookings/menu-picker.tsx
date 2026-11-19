"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import {
  defaultQuantity,
  priceLabel,
  extraChoices,
  ruleLabel,
  type Estimate,
  type MenuChoice,
  type MenuDef,
  type MenuItemDef,
  type MenuSectionDef,
} from "@/lib/menu";

type Props = {
  menu: MenuDef;
  choices: MenuChoice[];
  onChange: (next: MenuChoice[]) => void;
};

/** Pick dishes section by section, following each section's "choose" rule. */
export function MenuPicker({ menu, choices, onChange }: Props) {
  const chosen = new Map(choices.map((c) => [c.itemId, c]));
  // Sections that are complete fold down to the chosen dishes, unless opened.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const open = (id: string, on: boolean) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function toggle(section: MenuSectionDef, item: MenuItemDef) {
    if (chosen.has(item.id)) {
      onChange(choices.filter((c) => c.itemId !== item.id));
      return;
    }
    let next = choices;
    // In a package's "choose one" section, picking a dish replaces the other.
    // Per-person menus can offer guests a choice of several.
    if (section.maxChoices === 1 && menu.pricing === "package") {
      const ids = new Set(section.items.map((i) => i.id));
      next = next.filter((c) => !ids.has(c.itemId));
    }
    onChange([...next, { itemId: item.id, quantity: defaultQuantity(item), choices: [] }]);
  }

  function update(itemId: string, patch: Partial<MenuChoice>) {
    onChange(choices.map((c) => (c.itemId === itemId ? { ...c, ...patch } : c)));
  }

  return (
    <div className="grid gap-4">
      {menu.sections.map((s) => {
        const included = s.items.filter((i) => i.included);
        const selectable = s.items.filter((i) => !i.included);
        const picked = selectable.filter((i) => chosen.has(i.id)).length;
        const limited = menu.pricing === "package";
        const full = limited && s.maxChoices !== null && s.maxChoices > 1 && picked >= s.maxChoices;
        const guestsChoose = !limited && s.maxChoices !== null && picked > s.maxChoices;
        const folded = s.maxChoices !== null && picked >= s.maxChoices && !opened.has(s.id);
        const shown = folded ? selectable.filter((i) => chosen.has(i.id)) : selectable;
        return (
          <fieldset key={s.id} className="grid gap-2">
            {s.groupLabel ? <p className="m-0 font-semibold text-brand">{s.groupLabel}</p> : null}
            <legend className="sr-only">{s.name}</legend>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-base font-bold" aria-hidden>
                {s.name}
              </h3>
              <span className="text-sm text-muted">
                {ruleLabel(s)}
                {s.minChoices > 1 || (s.maxChoices ?? 0) > 1 || s.extraChoicePriceCents ? ` · ${picked} chosen` : ""}
                {extraChoices(s, choices) && s.includedChoices
                  ? ` (${extraChoices(s, choices)} extra)`
                  : ""}
              </span>
            </div>
            {included.length ? (
              <p className="m-0 text-sm text-muted">Included: {included.map((i) => i.name).join(", ")}</p>
            ) : null}
            {guestsChoose ? (
              <p className="m-0 rounded-lg bg-soft px-2.5 py-1.5 text-sm font-semibold">
                Guests choose between these {picked}. Each dish’s price is charged for every guest.
              </p>
            ) : !limited && s.maxChoices !== null && picked >= s.maxChoices && opened.has(s.id) ? (
              <p className="m-0 text-sm text-muted">
                Tick another dish to let guests choose between them (its price is charged for every guest).
              </p>
            ) : null}
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {shown.map((item) => {
                const c = chosen.get(item.id);
                const disabled = !c && full;
                return (
                  <li key={item.id} className={`rounded-xl border ${c ? "border-brand bg-soft" : "border-line"}`}>
                    <label
                      className={`flex min-h-11 items-center gap-3 px-3 py-2 ${disabled ? "opacity-50" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-[var(--brand)]"
                        checked={Boolean(c)}
                        disabled={disabled}
                        onChange={() => toggle(s, item)}
                      />
                      <span className="flex-1">{item.name}</span>
                      <span className="text-sm whitespace-nowrap text-muted">{priceLabel(item)}</span>
                    </label>
                    {c ? <ItemDetails item={item} section={s} choice={c} update={update} /> : null}
                  </li>
                );
              })}
            </ul>
            {folded ? (
              <button type="button" className="btn self-start" onClick={() => open(s.id, true)}>
                Change {s.name.toLowerCase()}
              </button>
            ) : opened.has(s.id) && s.maxChoices !== null && picked >= s.maxChoices ? (
              <button type="button" className="btn self-start" onClick={() => open(s.id, false)}>
                Done
              </button>
            ) : null}
          </fieldset>
        );
      })}
      {menu.includedNote ? <p className="m-0 text-sm text-muted">Price includes: {menu.includedNote}</p> : null}
    </div>
  );
}

function ItemDetails({
  item,
  section,
  choice,
  update,
}: {
  item: MenuItemDef;
  section: MenuSectionDef;
  choice: MenuChoice;
  update: (id: string, patch: Partial<MenuChoice>) => void;
}) {
  const parts: React.ReactNode[] = [];
  const n = item.choiceCount ?? 0;
  const options = item.choiceFromSection
    ? section.items.filter((i) => i.id !== item.id && !i.included && i.unit === "per_person" && !i.choiceCount).map((i) => i.name)
    : item.choiceOptions;

  if (n && options?.length) {
    if (n === 1) {
      parts.push(
        <label key="pick" className="field">
          Which one?
          <select
            className="input"
            value={choice.choices[0] ?? ""}
            onChange={(e) => update(item.id, { choices: e.target.value ? [e.target.value] : [] })}
          >
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>,
      );
    } else {
      parts.push(
        <fieldset key="pick" className="grid gap-1.5">
          <legend className="mb-1 text-sm text-muted">
            Choose {n} ({choice.choices.length} chosen)
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = choice.choices.includes(o);
              return (
                <label
                  key={o}
                  className={`flex min-h-10 items-center gap-2 rounded-lg border bg-surface px-2.5 text-sm ${
                    on ? "border-brand" : "border-line"
                  } ${!on && choice.choices.length >= n ? "opacity-50" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--brand)]"
                    checked={on}
                    disabled={!on && choice.choices.length >= n}
                    onChange={() =>
                      update(item.id, {
                        choices: on ? choice.choices.filter((x) => x !== o) : [...choice.choices, o],
                      })
                    }
                  />
                  {o}
                </label>
              );
            })}
          </div>
        </fieldset>,
      );
    }
  } else if (n) {
    parts.push(
      <div key="type" className="grid gap-1.5">
        <span className="text-sm text-muted">Which {n === 1 ? "kind" : `${n} kinds`}?</span>
        <div className={`grid gap-2 ${n > 1 ? "grid-cols-2" : ""}`}>
          {Array.from({ length: n }, (_, i) => (
            <input
              key={i}
              className="input"
              aria-label={`${item.name} choice ${i + 1}`}
              value={choice.choices[i] ?? ""}
              onChange={(e) => {
                const next = Array.from({ length: n }, (_, j) => choice.choices[j] ?? "");
                next[i] = e.target.value;
                update(item.id, { choices: next });
              }}
            />
          ))}
        </div>
      </div>,
    );
  }

  if (item.unit === "per_unit" || (item.unit === "flat" && item.extraUnitPriceCents)) {
    const extra = item.unit === "flat";
    parts.push(
      <label key="qty" className="field max-w-48">
        {extra
          ? `Additional ${item.extraUnitLabel ?? "units"}s (${money(item.extraUnitPriceCents ?? 0)} each)`
          : `How many ${item.unitLabel ?? "item"}s?`}
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={extra ? 0 : 1}
          value={choice.quantity}
          onChange={(e) =>
            update(item.id, { quantity: Math.max(extra ? 0 : 1, Math.min(999, parseInt(e.target.value, 10) || 0)) })
          }
        />
      </label>,
    );
  }

  if (!parts.length) return null;
  return <div className="grid gap-2 px-3 pb-3">{parts}</div>;
}

export function EstimateBox({ e, final = false }: { e: Estimate; final?: boolean }) {
  const gratuityPercent = e.gratuityPercent;
  return (
    <div className="rounded-xl bg-soft p-3.5" aria-live="polite">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {e.lines.map((l, i) => (
            <tr key={i}>
              <td className="py-0.5 pr-3">{l.label}</td>
              <td className="py-0.5 text-right tabular-nums">{money(l.cents)}</td>
            </tr>
          ))}
          {gratuityPercent ? (
            <tr>
              <td className="py-0.5 pr-3">Gratuity {gratuityPercent}%</td>
              <td className="py-0.5 text-right tabular-nums">{money(e.gratuityCents)}</td>
            </tr>
          ) : null}
          {e.waiterCents ? (
            <tr>
              <td className="py-0.5 pr-3">{e.waiterLabel}</td>
              <td className="py-0.5 text-right tabular-nums">{money(e.waiterCents)}</td>
            </tr>
          ) : null}
          {e.venueFeeCents ? (
            <tr>
              <td className="py-0.5 pr-3">{e.venueFeeLabel}</td>
              <td className="py-0.5 text-right tabular-nums">{money(e.venueFeeCents)}</td>
            </tr>
          ) : null}
          {e.taxCents ? (
            <tr>
              <td className="py-0.5 pr-3">Sales tax {e.taxPercent}%</td>
              <td className="py-0.5 text-right tabular-nums">{money(e.taxCents)}</td>
            </tr>
          ) : null}
          <tr className="font-bold">
            <td className="border-t border-line pt-1.5 pr-3">{final ? "Party total" : "Estimated total"}</td>
            <td className="border-t border-line pt-1.5 text-right tabular-nums">{money(e.totalCents)}</td>
          </tr>
          {e.depositCents ? (
            <>
              <tr>
                <td className="py-0.5 pr-3">Deposit received</td>
                <td className="py-0.5 text-right tabular-nums">−{money(e.depositCents)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-0.5 pr-3">Balance due</td>
                <td className="py-0.5 text-right tabular-nums">{money(e.balanceCents)}</td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>
      {e.notes.length ? (
        <p className="mt-2 mb-0 text-sm font-semibold">Holiday pricing: {e.notes.join("; ")}.</p>
      ) : null}
      {e.underMinimum ? (
        <p className="mt-2 mb-0 text-sm">The guest count is under the menu&rsquo;s minimum, so the estimate bills for the minimum.</p>
      ) : null}
      <p className="mt-2 mb-0 text-xs text-muted">
        {final ? "From the finalized guest count and menu." : "Estimate only. The final bill follows the final guest count and menu."}
      </p>
    </div>
  );
}
