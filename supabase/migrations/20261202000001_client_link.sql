-- A private link the client uses to send their guest count and menu.
-- What they send waits in client_submissions until the secretary applies it.

alter table public.bookings
  add column client_token text unique,
  add column client_token_created_at timestamptz;

create type public.submission_status as enum ('pending', 'applied', 'dismissed');

create table public.client_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  guests_men integer not null check (guests_men between 0 and 5000),
  guests_women integer not null check (guests_women between 0 and 5000),
  guests_children integer not null check (guests_children between 0 and 5000),
  -- [{ "item_id": uuid, "quantity": int, "choices": [text] }]
  menu_items jsonb not null default '[]',
  message text check (message is null or length(message) <= 4000),
  status public.submission_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  handled_by uuid references public.profiles (id),
  handled_at timestamptz
);
create index client_submissions_booking on public.client_submissions (booking_id, submitted_at desc);

-- Clients write through the server (secret key); staff read and handle them.
alter table public.client_submissions enable row level security;
create policy client_submissions_staff_read on public.client_submissions for select to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
create policy client_submissions_staff_update on public.client_submissions for update to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin', 'editor'))
  with check (org_id = app.current_org_id() and app.has_role('admin', 'editor'));
