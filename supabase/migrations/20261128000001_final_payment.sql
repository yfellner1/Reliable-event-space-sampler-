-- Final payment, recorded after the party by admins and editors.
alter table public.bookings
  add column final_paid boolean not null default false,
  add column final_paid_on date,
  add column final_paid_method public.payment_method,
  add column final_paid_amount_cents integer check (final_paid_amount_cents is null or final_paid_amount_cents > 0),
  add constraint final_payment_details check (not final_paid or (final_paid_on is not null and final_paid_method is not null));
