-- Settings that make the app work for any party or catering business:
--
-- * Business profile (name, tagline, contact details, brand color) shown on the
--   screens, the contract, and the reports.
-- * Which event types appear in the booking form, and in what order.
-- * Waiter staffing: price per waiter (for up to a set number of hours), a
--   minimum, and an optional price for each extra hour.
-- * Sales tax, added to the estimate.
-- * Menus can be tied to event types (a Bris package for brises), price
--   children separately with their own minimum, and price items per table.

alter type public.party_occasion add value if not exists 'melava_malka';
alter type public.party_occasion add value if not exists 'shalosh_seudos';
alter type public.party_occasion add value if not exists 'kiddush';
alter type public.party_occasion add value if not exists 'vort';

alter type public.menu_price_unit add value if not exists 'per_table';

alter table public.organizations
  add column tagline text check (tagline is null or length(tagline) <= 120),
  add column phone text check (phone is null or length(phone) <= 40),
  add column email text check (email is null or length(email) <= 120),
  add column website text check (website is null or length(website) <= 120),
  add column address text check (address is null or length(address) <= 200),
  add column brand_color text not null default '#2C7A4B' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Event types offered in the booking form, in order (keys of party_occasion).
  add column occasions text[] not null default '{bris,bat_mitzvah,upsherin,sheva_brachos,corporate,other}',
  add column sales_tax_percent numeric(6, 3) not null default 0 check (sales_tax_percent between 0 and 30),
  -- Waiters: 0 means the business doesn't send waiters.
  add column waiter_rate_cents integer not null default 0 check (waiter_rate_cents >= 0),
  add column waiter_min integer not null default 0 check (waiter_min between 0 and 50),
  add column waiter_hours_included integer not null default 4 check (waiter_hours_included between 1 and 24),
  add column waiter_extra_hour_cents integer check (waiter_extra_hour_cents is null or waiter_extra_hour_cents >= 0);

alter table public.menus
  -- Event types this menu is for (null: any). A booking uses the first menu
  -- for its party style whose event types include the booking's event type,
  -- and otherwise the first menu for its style with no event types set.
  add column occasions text[],
  -- When set, children pay this price (with their own minimum) instead of a
  -- share of the adult price.
  add column child_price_cents integer check (child_price_cents is null or child_price_cents >= 0),
  add column min_children integer not null default 0 check (min_children >= 0),
  -- For items priced per table.
  add column guests_per_table integer not null default 10 check (guests_per_table between 1 and 50);

alter table public.bookings
  add column waiters integer not null default 0 check (waiters between 0 and 50);

-- Staff see how many waiters go out with each job.
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
  b.menu_notes,
  b.occasion,
  b.occasion_other,
  b.head_table,
  b.mechitza,
  b.waiters
from public.bookings b
where b.org_id = app.current_org_id()
  and b.status = 'booked';
