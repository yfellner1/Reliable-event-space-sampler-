-- Menus, their sections and items, and what each booking chose.
--
-- A menu belongs to one or more party styles (Plated, Family style, Buffet,
-- Bris) and is priced either per person or as a package. Sections carry the
-- "choose N" rule. Items carry the add-on price and its unit. A booking's
-- choices are stored with a copy of the price at the time they were saved, so
-- later price changes do not alter parties already priced.

create type public.menu_pricing as enum ('per_person', 'package');
create type public.menu_price_unit as enum ('per_person', 'flat', 'per_unit');

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  name text not null check (btrim(name) <> ''),
  styles public.party_style[] not null check (cardinality(styles) > 0),
  pricing public.menu_pricing not null default 'per_person',
  -- Per person price, or the package price.
  base_price_cents integer not null check (base_price_cents >= 0),
  -- Saturday night per-person price and minimum, when different.
  saturday_price_cents integer check (saturday_price_cents is null or saturday_price_cents >= 0),
  min_guests integer not null default 0 check (min_guests >= 0),
  saturday_min_guests integer check (saturday_min_guests is null or saturday_min_guests >= 0),
  gratuity_percent numeric(5, 2) not null default 18 check (gratuity_percent between 0 and 100),
  -- Children beyond the minimum pay this share of the per-person price.
  child_price_percent integer not null default 100 check (child_price_percent between 0 and 100),
  included_note text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create table public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  -- Shown under the name, e.g. "Served with fish".
  note text,
  -- Shown above the section, e.g. "Main course: guests choose fish or pasta".
  group_label text,
  min_choices integer not null default 0 check (min_choices >= 0),
  -- Null means no upper limit.
  max_choices integer check (max_choices is null or max_choices >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_choices is null or max_choices >= min_choices)
);
create index menu_sections_menu_idx on public.menu_sections (menu_id, sort_order);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  section_id uuid not null references public.menu_sections (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  -- Always served, not chosen (e.g. the cold buffet on the bris menu).
  included boolean not null default false,
  price_cents integer not null default 0 check (price_cents >= 0),
  price_unit public.menu_price_unit not null default 'per_person',
  -- For per_unit items: what one unit is, e.g. "platter".
  unit_label text,
  -- Optional extras on a flat item, e.g. sushi: $250 for 7 platters, then
  -- $35 for each additional platter.
  extra_unit_price_cents integer check (extra_unit_price_cents is null or extra_unit_price_cents >= 0),
  extra_unit_label text,
  -- Sub-choices: e.g. Ravioli (choose 1: cheese, mushroom, sweet potato);
  -- Pizza (choose 2, typed in); Appetizer platter (choose 3 from this section).
  choice_count integer check (choice_count is null or choice_count between 1 and 10),
  choice_options text[],
  choice_from_section boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_section_idx on public.menu_items (section_id, sort_order);

create table public.booking_menu_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  item_id uuid not null references public.menu_items (id),
  -- Units for per_unit items; additional units for flat items with extras.
  quantity integer not null default 1 check (quantity between 0 and 999),
  choices text[] not null default '{}',
  -- Price copied from the item when saved.
  price_cents integer not null,
  price_unit public.menu_price_unit not null,
  extra_unit_price_cents integer,
  created_at timestamptz not null default now(),
  unique (booking_id, item_id)
);
create index booking_menu_items_booking_idx on public.booking_menu_items (booking_id);

alter table public.bookings
  add column menu_notes text,
  add column menu_updated_at timestamptz;

create trigger menus_touch before update on public.menus
  for each row execute function app.touch_updated_at();
create trigger menu_sections_touch before update on public.menu_sections
  for each row execute function app.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items
  for each row execute function app.touch_updated_at();

create trigger menus_audit after insert or update or delete on public.menus
  for each row execute function app.audit();
create trigger menu_sections_audit after insert or update or delete on public.menu_sections
  for each row execute function app.audit();
create trigger menu_items_audit after insert or update or delete on public.menu_items
  for each row execute function app.audit();

-- Sections and items take their organization from their parent.
create function app.menu_children_org() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'menu_sections' then
    select org_id into new.org_id from public.menus where id = new.menu_id;
  else
    select org_id into new.org_id from public.menu_sections where id = new.section_id;
  end if;
  if new.org_id is null then
    raise exception 'Unknown parent.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger menu_sections_org before insert or update on public.menu_sections
  for each row execute function app.menu_children_org();
create trigger menu_items_org before insert or update on public.menu_items
  for each row execute function app.menu_children_org();

-- ---------------------------------------------------------------------------
-- Security. Menus with prices: editors and admins read, admins change.
-- Kitchen staff read the chosen dishes through kitchen_menu, without prices.
-- ---------------------------------------------------------------------------

alter table public.menus enable row level security;
alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;
alter table public.booking_menu_items enable row level security;

create policy menus_select on public.menus for select to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
create policy menus_admin_insert on public.menus for insert to authenticated
  with check (org_id = app.current_org_id() and app.has_role('admin'));
create policy menus_admin_update on public.menus for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'))
  with check (org_id = app.current_org_id());

create policy menu_sections_select on public.menu_sections for select to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
create policy menu_sections_admin_insert on public.menu_sections for insert to authenticated
  with check (org_id = app.current_org_id() and app.has_role('admin'));
create policy menu_sections_admin_update on public.menu_sections for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'))
  with check (org_id = app.current_org_id());

create policy menu_items_select on public.menu_items for select to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
create policy menu_items_admin_insert on public.menu_items for insert to authenticated
  with check (org_id = app.current_org_id() and app.has_role('admin'));
create policy menu_items_admin_update on public.menu_items for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'))
  with check (org_id = app.current_org_id());

-- Menus, sections, and items are switched off rather than deleted, so past
-- bookings keep their history. No delete policies.

create policy booking_menu_items_select on public.booking_menu_items for select to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
-- Written only through set_booking_menu below.

-- ---------------------------------------------------------------------------
-- Save a booking's menu in one step: replaces all its choices, copying the
-- current prices. Runs as the caller, after checking they may edit bookings.
-- p_items: [{"item_id": uuid, "quantity": int, "choices": [text]}]
-- ---------------------------------------------------------------------------

create function public.set_booking_menu(p_booking_id uuid, p_items jsonb, p_notes text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  b public.bookings%rowtype;
  bad integer;
  kept jsonb;
begin
  if not app.has_role('admin', 'editor') then
    raise exception 'Only editors can change menus.' using errcode = '42501';
  end if;
  select * into b from public.bookings where id = p_booking_id and org_id = app.current_org_id();
  if not found then
    raise exception 'Unknown booking.' using errcode = 'P0002';
  end if;

  -- Every item must be active and belong to a menu for this party style.
  select count(*) into bad
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
  left join public.menu_items i on i.id = (x ->> 'item_id')::uuid and i.active and not i.included
  left join public.menu_sections s on s.id = i.section_id
  left join public.menus m on m.id = s.menu_id and m.org_id = b.org_id
  where m.id is null or not (b.party_style = any (m.styles));
  if bad > 0 then
    raise exception 'Some menu items are not on this party''s menu.' using errcode = '23514';
  end if;

  -- Items already on the booking keep the price they were saved with; new
  -- items take today's price.
  select coalesce(jsonb_object_agg(item_id::text, jsonb_build_object(
           'p', price_cents, 'u', price_unit, 'e', extra_unit_price_cents)), '{}'::jsonb)
    into kept
  from public.booking_menu_items where booking_id = b.id;

  delete from public.booking_menu_items where booking_id = b.id;
  insert into public.booking_menu_items
    (org_id, booking_id, item_id, quantity, choices, price_cents, price_unit, extra_unit_price_cents)
  select b.org_id, b.id, i.id,
         greatest(0, least(999, coalesce((x ->> 'quantity')::int, 1))),
         coalesce(array(select jsonb_array_elements_text(x -> 'choices')), '{}'),
         coalesce((kept -> i.id::text ->> 'p')::int, i.price_cents),
         coalesce((kept -> i.id::text ->> 'u')::public.menu_price_unit, i.price_unit),
         case when kept ? i.id::text then (kept -> i.id::text ->> 'e')::int else i.extra_unit_price_cents end
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
  join public.menu_items i on i.id = (x ->> 'item_id')::uuid;

  -- Recorded on the booking so its history shows the menu change.
  update public.bookings
     set menu_notes = nullif(btrim(coalesce(p_notes, '')), ''),
         menu_updated_at = now()
   where id = b.id;
end;
$$;

revoke all on function public.set_booking_menu(uuid, jsonb, text) from public, anon;
grant execute on function public.set_booking_menu(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kitchen views: the schedule gains the menu notes, and kitchen_menu lists the
-- chosen dishes for booked parties, with no prices.
-- ---------------------------------------------------------------------------

create or replace view public.kitchen_schedule
with (security_invoker = false, security_barrier = true)
as
select
  b.id,
  b.org_id,
  b.venue_id,
  b.slot_id,
  b.event_date,
  b.start_minute,
  b.duration_minutes,
  b.party_style,
  b.guests_men,
  b.guests_women,
  b.guests_children,
  b.guests_total,
  b.final_confirmed,
  b.other_venue_name,
  b.venue_address,
  b.menu_notes
from public.bookings b
where b.org_id = app.current_org_id()
  and b.status = 'booked';

create view public.kitchen_menu
with (security_invoker = false, security_barrier = true)
as
select
  bm.booking_id,
  s.name as section_name,
  s.sort_order as section_order,
  i.name as item_name,
  i.sort_order as item_order,
  i.price_unit,
  i.unit_label,
  i.extra_unit_label,
  bm.quantity,
  bm.choices
from public.booking_menu_items bm
join public.bookings b on b.id = bm.booking_id
join public.menu_items i on i.id = bm.item_id
join public.menu_sections s on s.id = i.section_id
where b.org_id = app.current_org_id()
  and (b.status = 'booked' or app.has_role('admin', 'editor'));

revoke all on public.kitchen_menu from anon, authenticated;
grant select on public.kitchen_menu to authenticated;
