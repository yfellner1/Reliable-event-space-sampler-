-- Needs-attention timings as settings an admin can change.
alter table public.organizations
  add column final_days integer not null default 7 check (final_days between 1 and 60),
  add column contract_days integer not null default 7 check (contract_days between 1 and 60);
