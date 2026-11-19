-- Menu sections can include a number of choices in the base price, with each
-- choice beyond that costing a per-person price ("Salad: choose two,
-- additional choices +$3 pp").

alter table public.menu_sections
  add column included_choices integer check (included_choices is null or included_choices >= 0),
  add column extra_choice_price_cents integer check (extra_choice_price_cents is null or extra_choice_price_cents >= 0);
