import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { requireRole } from "@/lib/auth";
import { money } from "@/lib/format";
import { priceLabel, ruleLabel } from "@/lib/menu";
import { ALL_OCCASIONS, OCCASION_LABELS, STYLE_LABELS, occasionLabel, type PartyOccasion, type PartyStyle } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { addItem, addSection, updateItem, updateMenu, updateSection } from "./actions";

export const metadata: Metadata = { title: "Menus" };

const dollars = (c: number | null) => (c === null ? "" : String(c / 100));

type ItemRow = {
  id: string;
  name: string;
  included: boolean;
  price_cents: number;
  price_unit: "per_person" | "flat" | "per_unit" | "per_table";
  unit_label: string | null;
  extra_unit_price_cents: number | null;
  extra_unit_label: string | null;
  choice_count: number | null;
  choice_options: string[] | null;
  choice_from_section: boolean;
  active: boolean;
  sort_order: number;
};

function ItemFields({ item }: { item?: ItemRow }) {
  return (
    <>
      <label className="field">
        Name
        <input className="input" name="name" defaultValue={item?.name} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Price ($)
          <input className="input" name="price" inputMode="decimal" defaultValue={dollars(item?.price_cents ?? 0)} />
        </label>
        <label className="field">
          Priced
          <select className="input" name="unit" defaultValue={item?.price_unit ?? "per_person"}>
            <option value="per_person">Per person</option>
            <option value="flat">Flat, once</option>
            <option value="per_unit">Per platter / unit</option>
            <option value="per_table">Per table</option>
          </select>
        </label>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-brand">More options</summary>
        <div className="mt-2 grid gap-2">
          <label className="field">
            Unit name, for per-unit pricing (e.g. platter)
            <input className="input" name="unitLabel" defaultValue={item?.unit_label ?? ""} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              Extra unit price ($)
              <input
                className="input"
                name="extra"
                inputMode="decimal"
                defaultValue={dollars(item?.extra_unit_price_cents ?? null)}
              />
            </label>
            <label className="field">
              Extra unit name
              <input className="input" name="extraLabel" defaultValue={item?.extra_unit_label ?? ""} />
            </label>
          </div>
          <label className="field">
            Sub-choices: how many to pick (e.g. 2 pizza kinds)
            <input
              className="input"
              name="choiceCount"
              inputMode="numeric"
              defaultValue={item?.choice_count ?? ""}
            />
          </label>
          <label className="field">
            Sub-choice options, separated by commas (leave empty to type them in)
            <input className="input" name="options" defaultValue={item?.choice_options?.join(", ") ?? ""} />
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="fromSection"
              defaultChecked={item?.choice_from_section}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            Pick the sub-choices from the other dishes in this section
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name="included"
              defaultChecked={item?.included}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            Always included (not chosen)
          </label>
        </div>
      </details>
    </>
  );
}

export default async function MenusPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: menus } = await supabase
    .from("menus")
    .select(
      "id, name, styles, pricing, base_price_cents, saturday_price_cents, min_guests, saturday_min_guests, gratuity_percent, child_price_percent, occasions, child_price_cents, min_children, guests_per_table, included_note, sort_order, menu_sections(id, name, note, group_label, min_choices, max_choices, included_choices, extra_choice_price_cents, sort_order, menu_items(id, name, included, price_cents, price_unit, unit_label, extra_unit_price_cents, extra_unit_label, choice_count, choice_options, choice_from_section, active, sort_order))",
    )
    .order("sort_order");

  return (
    <div className="grid gap-4">
      <section className="panel">
        <h2 className="text-lg font-bold">Menus</h2>
        <p className="mt-1 mb-0 text-sm text-muted">
          Changes apply to new choices right away. Dishes already saved on a booking keep the price they were saved
          with. Switch a dish off instead of deleting it.
        </p>
      </section>

      {menus?.map((m) => {
        const sections = [...(m.menu_sections ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        return (
          <section key={m.id} className="panel grid gap-3" aria-labelledby={`menu-${m.id}`}>
            <div>
              <h2 id={`menu-${m.id}`} className="text-xl font-bold">
                {m.name}
              </h2>
              <p className="m-0 text-sm text-muted">
                For{" "}
                {m.occasions?.length
                  ? m.occasions.map((o) => occasionLabel(o as PartyOccasion)).join(", ")
                  : (m.styles as PartyStyle[]).map((s) => STYLE_LABELS[s]).join(", ")}{" "}
                ·{" "}
                {m.pricing === "package"
                  ? `${money(m.base_price_cents)} package`
                  : m.base_price_cents
                    ? `${money(m.base_price_cents)} per ${m.child_price_cents !== null ? "adult" : "person"}${
                        m.child_price_cents !== null ? `, ${money(m.child_price_cents)} per child` : ""
                      }`
                    : "priced by what is chosen"}
              </p>
            </div>

            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer font-semibold">Prices and minimums</summary>
              <ActionForm action={updateMenu} submitLabel="Save prices" className="mt-3 grid gap-3">
                <input type="hidden" name="id" value={m.id} />
                <div className="grid grid-cols-2 gap-2">
                  <label className="field">
                    {m.pricing === "package" ? "Package price ($)" : "Per person ($)"}
                    <input className="input" name="base" inputMode="decimal" defaultValue={dollars(m.base_price_cents)} />
                  </label>
                  <label className="field">
                    Minimum guests
                    <input className="input" name="min" inputMode="numeric" defaultValue={m.min_guests} />
                  </label>
                  {m.pricing === "per_person" ? (
                    <>
                      <label className="field">
                        Saturday night per person ($)
                        <input
                          className="input"
                          name="saturday"
                          inputMode="decimal"
                          defaultValue={dollars(m.saturday_price_cents)}
                        />
                      </label>
                      <label className="field">
                        Saturday night minimum
                        <input
                          className="input"
                          name="saturdayMin"
                          inputMode="numeric"
                          defaultValue={m.saturday_min_guests ?? ""}
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="field">
                    Gratuity (%)
                    <input className="input" name="gratuity" inputMode="decimal" defaultValue={Number(m.gratuity_percent)} />
                  </label>
                  <label className="field">
                    Children past the minimum pay (% of base price)
                    <input className="input" name="child" inputMode="numeric" defaultValue={m.child_price_percent} />
                  </label>
                  <label className="field">
                    Or a set price per child ($)
                    <input
                      className="input"
                      name="childPrice"
                      inputMode="decimal"
                      placeholder="Not set"
                      defaultValue={dollars(m.child_price_cents)}
                    />
                  </label>
                  <label className="field">
                    Minimum children (with a set price)
                    <input className="input" name="minChildren" inputMode="numeric" defaultValue={m.min_children} />
                  </label>
                  <label className="field">
                    Guests per table (for per-table items)
                    <input className="input" name="perTable" inputMode="numeric" defaultValue={m.guests_per_table} />
                  </label>
                </div>
                <fieldset className="grid gap-1">
                  <legend className="mb-1 text-sm text-muted">
                    Used for these event types (none ticked: any event type without its own menu)
                  </legend>
                  <div className="flex flex-wrap gap-x-4">
                    {ALL_OCCASIONS.map((o) => (
                      <label key={o} className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          name="occasion"
                          value={o}
                          defaultChecked={m.occasions?.includes(o) ?? false}
                          className="h-5 w-5 accent-[var(--brand)]"
                        />
                        {OCCASION_LABELS[o]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="field">
                  Price includes
                  <textarea className="input min-h-16" name="included" defaultValue={m.included_note ?? ""} />
                </label>
              </ActionForm>
            </details>

            {sections.map((s) => {
              const items = [...(s.menu_items ?? [])].sort((a, b) => a.sort_order - b.sort_order) as ItemRow[];
              return (
                <details key={s.id} className="rounded-xl border border-line p-3">
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-3 font-semibold">
                    <span>{s.name}</span>
                    <span className="text-sm font-normal text-muted">
                      {ruleLabel({
                        id: s.id,
                        name: s.name,
                        note: s.note,
                        groupLabel: s.group_label,
                        minChoices: s.min_choices,
                        maxChoices: s.max_choices,
                        includedChoices: s.included_choices,
                        extraChoicePriceCents: s.extra_choice_price_cents,
                        items: items.map((i) => ({
                          id: i.id,
                          name: i.name,
                          included: i.included,
                          priceCents: i.price_cents,
                          unit: i.price_unit,
                          unitLabel: i.unit_label,
                          extraUnitPriceCents: i.extra_unit_price_cents,
                          extraUnitLabel: i.extra_unit_label,
                          choiceCount: i.choice_count,
                          choiceOptions: i.choice_options,
                          choiceFromSection: i.choice_from_section,
                        })),
                      })}{" "}
                      · {items.filter((i) => i.active).length} dishes
                    </span>
                  </summary>

                  <div className="mt-3 grid gap-3">
                    <details className="rounded-lg bg-soft p-3">
                      <summary className="cursor-pointer text-sm font-semibold">Section name and rule</summary>
                      <ActionForm action={updateSection} submitLabel="Save section" className="mt-2 grid gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <SectionFields s={s} />
                      </ActionForm>
                    </details>

                    <ul className="m-0 grid list-none gap-1.5 p-0">
                      {items.map((i) => (
                        <li key={i.id} className="rounded-lg border border-line">
                          <details>
                            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2">
                              <span className={i.active ? "" : "text-muted line-through"}>{i.name}</span>
                              <span className="text-sm whitespace-nowrap text-muted">
                                {!i.active
                                  ? "Off"
                                  : priceLabel({
                                      id: i.id,
                                      name: i.name,
                                      included: i.included,
                                      priceCents: i.price_cents,
                                      unit: i.price_unit,
                                      unitLabel: i.unit_label,
                                      extraUnitPriceCents: i.extra_unit_price_cents,
                                      extraUnitLabel: i.extra_unit_label,
                                      choiceCount: i.choice_count,
                                      choiceOptions: i.choice_options,
                                      choiceFromSection: i.choice_from_section,
                                    }) || "No extra charge"}
                              </span>
                            </summary>
                            <ActionForm action={updateItem} submitLabel="Save dish" className="grid gap-2 px-3 pb-3">
                              <input type="hidden" name="id" value={i.id} />
                              <ItemFields item={i} />
                              <label className="flex min-h-11 items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  name="active"
                                  defaultChecked={i.active}
                                  className="h-5 w-5 accent-[var(--brand)]"
                                />
                                On the menu
                              </label>
                            </ActionForm>
                          </details>
                        </li>
                      ))}
                    </ul>

                    <details className="rounded-lg border border-dashed border-line p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-brand">+ Add a dish</summary>
                      <ActionForm action={addItem} submitLabel="Add dish" resetOnSuccess className="mt-2 grid gap-2">
                        <input type="hidden" name="sectionId" value={s.id} />
                        <ItemFields />
                      </ActionForm>
                    </details>
                  </div>
                </details>
              );
            })}

            <details className="rounded-xl border border-dashed border-line p-3">
              <summary className="cursor-pointer font-semibold text-brand">+ Add a section</summary>
              <ActionForm action={addSection} submitLabel="Add section" resetOnSuccess className="mt-3 grid gap-2">
                <input type="hidden" name="menuId" value={m.id} />
                <SectionFields />
              </ActionForm>
            </details>
          </section>
        );
      })}
    </div>
  );
}

function SectionFields({
  s,
}: {
  s?: {
    name: string;
    note: string | null;
    group_label: string | null;
    min_choices: number;
    max_choices: number | null;
    included_choices: number | null;
    extra_choice_price_cents: number | null;
  };
}) {
  return (
    <>
      <label className="field">
        Name
        <input className="input" name="name" defaultValue={s?.name} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Choose at least
          <input className="input" name="min" inputMode="numeric" defaultValue={s?.min_choices ?? 1} />
        </label>
        <label className="field">
          Choose at most (empty = no limit)
          <input className="input" name="max" inputMode="numeric" defaultValue={s?.max_choices ?? ""} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="field">
          Choices included in the price
          <input className="input" name="included" inputMode="numeric" defaultValue={s?.included_choices ?? ""} />
        </label>
        <label className="field">
          Each additional choice ($ per person, empty = none)
          <input
            className="input"
            name="extra"
            inputMode="decimal"
            defaultValue={dollars(s?.extra_choice_price_cents ?? null)}
          />
        </label>
      </div>
      <label className="field">
        Note under the name (e.g. Served with fish)
        <input className="input" name="note" defaultValue={s?.note ?? ""} />
      </label>
      <label className="field">
        Heading above the section (e.g. Main course: guests choose fish or pasta)
        <input className="input" name="group" defaultValue={s?.group_label ?? ""} />
      </label>
    </>
  );
}
