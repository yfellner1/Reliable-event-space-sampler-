-- Holiday pricing: a higher waitstaff gratuity on some federal holidays, and
-- special per-person prices during Chanukah. Editable in Settings.
alter table public.organizations
  add column holiday_gratuity_percent numeric(5,2) not null default 27
    check (holiday_gratuity_percent between 0 and 100),
  -- Keys from src/lib/holiday-pricing.ts (HOLIDAY_OPTIONS).
  add column holiday_gratuity_days text[] not null
    default '{}',
  -- Per-person price by party style during Chanukah, in cents ({} = no change).
  add column chanukah_prices jsonb not null default '{}';
