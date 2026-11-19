-- Unpaid holds never expire: they stay on the calendar as "Needs deposit"
-- until someone records the deposit or cancels them. hold_expires_at now only
-- marks when an unpaid hold becomes urgent in Needs attention.

-- The expiry job and the "free run-out holds" step do nothing from now on.
create or replace function app.expire_holds(
  p_venue_id uuid default null,
  p_event_date date default null,
  p_slot_id uuid default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  return 0;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'expire-holds') then
    perform cron.unschedule('expire-holds');
  end if;
end;
$$;

-- Holds that already expired come back, unless someone else has the slot now.
do $$
declare
  r record;
begin
  for r in select id, venue_id, event_date, slot_id, blocks_slot from public.bookings
           where status = 'expired' order by created_at loop
    if not r.blocks_slot or not exists (
      select 1 from public.bookings o
      where o.venue_id = r.venue_id and o.event_date = r.event_date and o.slot_id = r.slot_id
        and o.status in ('hold', 'booked') and o.blocks_slot and o.id <> r.id
    ) then
      update public.bookings set status = 'hold' where id = r.id;
    end if;
  end loop;
end;
$$;
