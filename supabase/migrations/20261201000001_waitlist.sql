-- People who asked for a date and time of day. was_full records whether it was
-- already taken when they asked: the owner counts these to judge demand for
-- another location.

create type public.request_status as enum ('waiting', 'contacted', 'booked', 'not_interested');

create table public.date_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  event_date date not null,
  slot_id uuid not null references public.slots (id),
  -- The venue they wanted, or null for any.
  venue_id uuid references public.venues (id),
  client_name text not null check (btrim(client_name) <> ''),
  client_phone text not null default '',
  client_email text,
  guests integer check (guests is null or guests >= 0),
  party_style public.party_style,
  notes text,
  was_full boolean not null,
  status public.request_status not null default 'waiting',
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index date_requests_org_date on public.date_requests (org_id, event_date);

alter table public.date_requests enable row level security;
create policy date_requests_staff on public.date_requests for all to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'))
  with check (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
