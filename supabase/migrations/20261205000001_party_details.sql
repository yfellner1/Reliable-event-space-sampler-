-- Type of party, and whether it needs a head table and a mechitza (divider).

create type public.party_occasion as enum ('sheva_brachos', 'bris', 'bat_mitzvah', 'corporate', 'upsherin', 'other');

alter table public.bookings
  add column occasion public.party_occasion,
  -- What "Other" is, in the secretary's words.
  add column occasion_other text check (occasion_other is null or length(occasion_other) <= 100),
  add column head_table boolean not null default false,
  add column mechitza boolean not null default false;

-- Parties imported from the Google calendar: read these from their notes.
update public.bookings set occasion = 'sheva_brachos'
where import_ref is not null and occasion is null and notes ~* '^\s*sheva brachos';
update public.bookings set head_table = true
where import_ref is not null and notes ~* 'head table' and notes !~* 'no head table';
update public.bookings set mechitza = true
where import_ref is not null and notes ~* '(divider|mechitza)' and notes !~* 'no divider';

-- The kitchen and floor staff see these too (they're about setting up the room).
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
  b.mechitza
from public.bookings b
where b.org_id = app.current_org_id()
  and b.status = 'booked';
