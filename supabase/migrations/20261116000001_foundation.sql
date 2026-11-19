-- Party and event booking: foundation schema.
--
-- Organizations, members with roles, venues, slots, bookings, kitchen notes,
-- and an audit log. Security is enforced here with row-level security, so the
-- rules hold no matter which screen or script talks to the database.
--
-- Roles:
--   admin   - everything, plus users, venues, slots, and settings
--   editor  - create and edit bookings (the secretary)
--   kitchen - read-only schedule (no prices, deposits, contracts, or client
--             contact details) and can leave notes on a party

create schema if not exists app;
grant usage on schema app to authenticated;

-- Nothing in this app is public. Remove the default grants Supabase gives the
-- anon role, so a request without a login can read nothing even if a policy
-- is ever written too loosely.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

create type public.member_role as enum ('admin', 'editor', 'kitchen');
create type public.booking_status as enum ('hold', 'booked', 'cancelled', 'expired');
create type public.payment_method as enum ('cash', 'check', 'zelle', 'credit_card');
create type public.party_style as enum ('plated', 'family', 'buffet', 'bris');
create type public.venue_kind as enum ('event_space', 'catering', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (btrim(name) <> ''),
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id),
  username text not null unique
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  display_name text not null check (btrim(display_name) <> ''),
  role public.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (org_id);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  name text not null check (btrim(name) <> ''),
  code text not null check (code ~ '^[A-Z0-9]{1,2}$'),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind public.venue_kind not null default 'event_space',
  -- true: one party per slot at this venue. false: several bookings may share
  -- a slot (used for "Other" locations).
  exclusive boolean not null default true,
  extra_fee_cents integer not null default 0 check (extra_fee_cents >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name),
  unique (org_id, code)
);

-- Times are minutes after midnight, local to the organization's timezone.
create table public.slots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  key text not null check (key ~ '^[a-z_]{2,30}$'),
  label text not null check (btrim(label) <> ''),
  start_earliest smallint not null check (start_earliest between 0 and 1439),
  start_latest smallint not null check (start_latest between 0 and 1439),
  -- Latest allowed end time. Null means no fixed limit beyond max_minutes.
  end_latest smallint check (end_latest between 1 and 1440),
  max_minutes smallint not null default 180 check (max_minutes between 30 and 720),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key),
  check (start_latest >= start_earliest),
  check (end_latest is null or end_latest > start_earliest)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  venue_id uuid not null references public.venues (id),
  slot_id uuid not null references public.slots (id),
  event_date date not null,
  start_minute smallint not null check (start_minute between 0 and 1439),
  duration_minutes smallint not null check (duration_minutes between 30 and 720),
  -- Copied from venues.exclusive by trigger. Drives the double-booking index.
  blocks_slot boolean not null default true,

  status public.booking_status not null default 'hold',
  hold_expires_at timestamptz,

  client_first_name text not null check (btrim(client_first_name) <> ''),
  client_last_name text not null check (btrim(client_last_name) <> ''),
  client_phone text not null check (btrim(client_phone) <> ''),
  client_email text check (client_email is null or client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- For "Other" venues and outside catering.
  other_venue_name text,
  venue_address text,
  -- Overrides the venue's standard extra fee when set (used for "Other").
  venue_fee_cents integer check (venue_fee_cents is null or venue_fee_cents >= 0),

  party_style public.party_style not null default 'plated',
  guests_men integer not null default 0 check (guests_men >= 0),
  guests_women integer not null default 0 check (guests_women >= 0),
  guests_children integer not null default 0 check (guests_children >= 0),
  guests_total integer generated always as (guests_men + guests_women + guests_children) stored,

  notes text,

  deposit_paid boolean not null default false,
  deposit_method public.payment_method,
  deposit_amount_cents integer check (deposit_amount_cents is null or deposit_amount_cents > 0),
  deposit_received_on date,

  contract_sent_on date,
  contract_signed_on date,
  -- Path of the signed contract in the private storage bucket (phase 8).
  contract_file_path text,

  final_confirmed boolean not null default false,

  cancelled_at timestamptz,
  cancel_reason text,

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),

  constraint deposit_details_required check (
    not deposit_paid
    or (deposit_method is not null and deposit_amount_cents is not null and deposit_received_on is not null)
  ),
  constraint hold_needs_expiry check (status <> 'hold' or hold_expires_at is not null),
  constraint booked_needs_deposit check (status <> 'booked' or deposit_paid),
  constraint final_needs_guests check (not final_confirmed or guests_total > 0)
);

-- The double-booking rule. Two people saving the same venue, date, and slot at
-- the same moment cannot both succeed: the second insert fails with a unique
-- violation (SQLSTATE 23505).
create unique index bookings_one_per_slot
  on public.bookings (venue_id, event_date, slot_id)
  where status in ('hold', 'booked') and blocks_slot;

create index bookings_org_date_idx on public.bookings (org_id, event_date);
create index bookings_hold_expiry_idx on public.bookings (hold_expires_at) where status = 'hold';

create table public.booking_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by uuid references public.profiles (id)
);
create index booking_notes_booking_idx on public.booking_notes (booking_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid,
  at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index audit_log_row_idx on public.audit_log (table_name, row_id, at desc);
create index audit_log_org_idx on public.audit_log (org_id, at desc);

-- ---------------------------------------------------------------------------
-- Helper functions used by policies. SECURITY DEFINER so they can read
-- profiles without recursing into the profiles policies.
-- ---------------------------------------------------------------------------

create function app.current_org_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select org_id from public.profiles where id = auth.uid() and active
$$;

create function app.my_role() returns public.member_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function app.has_role(variadic roles public.member_role[]) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.role = any (roles) from public.profiles p where p.id = auth.uid() and p.active),
    false
  )
$$;

revoke all on function app.current_org_id() from public;
revoke all on function app.my_role() from public;
revoke all on function app.has_role(public.member_role[]) from public;
grant execute on function app.current_org_id() to authenticated;
grant execute on function app.my_role() to authenticated;
grant execute on function app.has_role(public.member_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function app.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_touch before update on public.organizations
  for each row execute function app.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();
create trigger venues_touch before update on public.venues
  for each row execute function app.touch_updated_at();
create trigger slots_touch before update on public.slots
  for each row execute function app.touch_updated_at();

-- An organization must always keep at least one active admin.
create function app.keep_one_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active) then
    if not exists (
      select 1 from public.profiles
      where org_id = old.org_id and role = 'admin' and active and id <> old.id
    ) then
      raise exception 'An organization needs at least one active admin.'
        using errcode = 'P0001', hint = 'last_admin';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_keep_one_admin before update or delete on public.profiles
  for each row execute function app.keep_one_admin();

-- Mark holds whose time ran out. Called every minute by pg_cron, and for a
-- single slot right before a booking is saved there.
create function app.expire_holds(
  p_venue_id uuid default null,
  p_event_date date default null,
  p_slot_id uuid default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  update public.bookings
     set status = 'expired'
   where status = 'hold'
     and hold_expires_at <= now()
     and (p_venue_id is null or venue_id = p_venue_id)
     and (p_event_date is null or event_date = p_event_date)
     and (p_slot_id is null or slot_id = p_slot_id);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function app.expire_holds(uuid, date, uuid) from public;

create function app.bookings_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v public.venues%rowtype;
  s public.slots%rowtype;
begin
  -- Rows changed by app.expire_holds (nested trigger call): only the status
  -- moves, nothing else to check.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select * into v from public.venues where id = new.venue_id;
  if not found then
    raise exception 'Unknown venue.' using errcode = '23503';
  end if;
  select * into s from public.slots where id = new.slot_id;
  if not found or s.org_id <> v.org_id then
    raise exception 'Unknown slot for this venue.' using errcode = '23503';
  end if;

  new.org_id := v.org_id;
  new.blocks_slot := v.exclusive;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  else
    new.created_by := auth.uid();
    new.created_at := now();
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();

  if v.kind = 'other' and coalesce(btrim(new.other_venue_name), '') = '' then
    raise exception 'Enter the name of the other location.' using errcode = '23514';
  end if;

  -- Time rules for the slot.
  if new.start_minute < s.start_earliest or new.start_minute > s.start_latest then
    raise exception '% parties must start between % and % minutes after midnight.',
      s.label, s.start_earliest, s.start_latest
      using errcode = '23514', hint = 'slot_start';
  end if;
  if new.duration_minutes > s.max_minutes then
    raise exception '% parties can last % minutes at most.', s.label, s.max_minutes
      using errcode = '23514', hint = 'slot_length';
  end if;
  if s.end_latest is not null and new.start_minute + new.duration_minutes > s.end_latest then
    raise exception '% parties must end by % minutes after midnight.', s.label, s.end_latest
      using errcode = '23514', hint = 'slot_end';
  end if;

  -- Paying the deposit turns a hold into a booking.
  if new.deposit_paid and new.status in ('hold', 'expired') then
    new.status := 'booked';
  end if;
  if new.status <> 'hold' then
    new.hold_expires_at := case when new.status = 'expired' then new.hold_expires_at end;
  end if;

  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then
    new.cancelled_at := now();
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
  end if;

  -- Free the slot from any hold that already ran out, so it does not block
  -- this save while waiting for the next pg_cron run.
  if new.status in ('hold', 'booked') and new.blocks_slot then
    perform app.expire_holds(new.venue_id, new.event_date, new.slot_id);
  end if;

  return new;
end;
$$;

create trigger bookings_before_write before insert or update on public.bookings
  for each row execute function app.bookings_before_write();

create function app.booking_notes_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select org_id into new.org_id from public.bookings where id = new.booking_id;
  if new.org_id is null then
    raise exception 'Unknown booking.' using errcode = '23503';
  end if;
  new.author_id := auth.uid();
  new.created_at := now();
  new.read_at := null;
  new.read_by := null;
  return new;
end;
$$;

create trigger booking_notes_before_insert before insert on public.booking_notes
  for each row execute function app.booking_notes_before_insert();

-- Audit trail: who changed what, and when.
create function app.audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_j jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  org uuid;
  rid uuid;
begin
  if tg_op = 'UPDATE' and old_j = new_j then
    return new;
  end if;
  rid := coalesce(new_j, old_j) ->> 'id';
  org := case
    when tg_table_name = 'organizations' then rid
    else (coalesce(new_j, old_j) ->> 'org_id')::uuid
  end;
  insert into public.audit_log (org_id, table_name, row_id, action, actor_id, old_data, new_data)
  values (org, tg_table_name, rid, lower(tg_op), auth.uid(), old_j, new_j);
  return coalesce(new, old);
end;
$$;

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function app.audit();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function app.audit();
create trigger venues_audit after insert or update or delete on public.venues
  for each row execute function app.audit();
create trigger slots_audit after insert or update or delete on public.slots
  for each row execute function app.audit();
create trigger bookings_audit after insert or update or delete on public.bookings
  for each row execute function app.audit();
create trigger booking_notes_audit after insert or update or delete on public.booking_notes
  for each row execute function app.audit();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_notes enable row level security;
alter table public.audit_log enable row level security;

-- Organizations: members read their own; admins rename it.
create policy organizations_select on public.organizations for select to authenticated
  using (id = app.current_org_id());
create policy organizations_update on public.organizations for update to authenticated
  using (id = app.current_org_id() and app.has_role('admin'))
  with check (id = app.current_org_id());

-- Profiles: members see their colleagues. Accounts are created and changed only
-- by the server with the service key, after it checks the caller is an admin.
create policy profiles_select on public.profiles for select to authenticated
  using (org_id = app.current_org_id());

-- Venues and slots: everyone in the organization reads; admins change.
create policy venues_select on public.venues for select to authenticated
  using (org_id = app.current_org_id());
create policy venues_admin_insert on public.venues for insert to authenticated
  with check (org_id = app.current_org_id() and app.has_role('admin'));
create policy venues_admin_update on public.venues for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'))
  with check (org_id = app.current_org_id());
create policy venues_admin_delete on public.venues for delete to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'));

create policy slots_select on public.slots for select to authenticated
  using (org_id = app.current_org_id());
create policy slots_admin_insert on public.slots for insert to authenticated
  with check (org_id = app.current_org_id() and app.has_role('admin'));
create policy slots_admin_update on public.slots for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'))
  with check (org_id = app.current_org_id());
create policy slots_admin_delete on public.slots for delete to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'));

-- Bookings: editors and admins only. Kitchen staff read the kitchen_schedule
-- view instead, which leaves out prices, deposits, contracts, and contact details.
create policy bookings_select on public.bookings for select to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
create policy bookings_insert on public.bookings for insert to authenticated
  with check (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
create policy bookings_update on public.bookings for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'))
  with check (org_id = app.current_org_id());
create policy bookings_delete on public.bookings for delete to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'));

-- Notes: anyone in the organization can leave one on a booked party; editors
-- and admins read them all and mark them read; kitchen staff see their own.
create policy booking_notes_select on public.booking_notes for select to authenticated
  using (
    org_id = app.current_org_id()
    and (app.has_role('admin', 'editor') or author_id = auth.uid())
  );
create policy booking_notes_insert on public.booking_notes for insert to authenticated
  with check (org_id = app.current_org_id() and author_id = auth.uid());
create policy booking_notes_update on public.booking_notes for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'))
  with check (org_id = app.current_org_id());
create policy booking_notes_delete on public.booking_notes for delete to authenticated
  using (org_id = app.current_org_id() and (app.has_role('admin') or author_id = auth.uid()));

-- Audit log: editors and admins read; only the audit trigger writes.
create policy audit_log_select on public.audit_log for select to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'));

-- Only the read and write rights each role needs.
revoke all on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;
revoke insert, update, delete on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Kitchen schedule: the only view of bookings kitchen staff get. It runs with
-- the owner's rights (bypassing the bookings policies) and filters to the
-- caller's organization itself, returning booked parties only and no money,
-- contract, or client contact columns.
-- ---------------------------------------------------------------------------

create view public.kitchen_schedule
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
  b.venue_address
from public.bookings b
where b.org_id = app.current_org_id()
  and b.status = 'booked';

revoke all on public.kitchen_schedule from anon, authenticated;
grant select on public.kitchen_schedule to authenticated;

-- ---------------------------------------------------------------------------
-- Expire holds every minute (pg_cron is available on Supabase).
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-holds', '* * * * *', 'select app.expire_holds()');
  end if;
end;
$$;
