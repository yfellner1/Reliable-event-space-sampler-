-- Finding returning customers by phone, whatever way the number was typed.
alter table public.bookings
  add column client_phone_digits text generated always as (regexp_replace(client_phone, '\D', '', 'g')) stored;
create index bookings_org_phone_digits on public.bookings (org_id, client_phone_digits);
