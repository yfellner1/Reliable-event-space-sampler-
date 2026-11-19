-- Importing parties from the old Google calendar.
--
-- * Calendar entries often give only a family name, so the first name may be
--   empty on imported bookings (the booking form still asks for one).
-- * import_ref remembers which calendar event a booking came from, so running
--   the import twice never makes duplicates.
-- * admin_import_booking lets past arrangements in even when they break
--   today's schedule rules, and keeps both parties when the calendar had two in
--   the same venue and slot.

alter table public.bookings drop constraint bookings_client_first_name_check;
alter table public.bookings add constraint bookings_client_first_name_check check (client_first_name is not null);
alter table public.bookings add column import_ref text;
create unique index bookings_import_ref on public.bookings (org_id, import_ref) where import_ref is not null;

create or replace function app.bookings_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v public.venues%rowtype;
  s public.slots%rowtype;
  tz text;
  dow smallint;
  schedule_changed boolean;
  -- Set only inside public.admin_import_booking (transaction-local).
  importing boolean := coalesce(current_setting('app.importing', true), '') = 'on';
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
  select timezone into tz from public.organizations where id = v.org_id;

  new.org_id := v.org_id;
  if tg_op = 'UPDATE' and not old.blocks_slot and v.exclusive
     and (new.venue_id, new.event_date, new.slot_id) = (old.venue_id, old.event_date, old.slot_id) then
    -- An imported party that shares its slot with another keeps sharing it.
    new.blocks_slot := false;
  else
    new.blocks_slot := v.exclusive;
  end if;
  if importing and new.blocks_slot and exists (
    select 1 from public.bookings o
    where o.venue_id = new.venue_id and o.event_date = new.event_date and o.slot_id = new.slot_id
      and o.status in ('hold', 'booked') and o.blocks_slot and o.id <> new.id
  ) then
    -- The old calendar had two parties here; keep both rather than lose one.
    new.blocks_slot := false;
  end if;

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

  -- Schedule rules are checked when a booking is made or its timing changes,
  -- so a later change to the rules never blocks editing an existing booking.
  schedule_changed := tg_op = 'INSERT'
    or (new.venue_id, new.slot_id, new.event_date, new.start_minute, new.duration_minutes, new.party_style)
       is distinct from
       (old.venue_id, old.slot_id, old.event_date, old.start_minute, old.duration_minutes, old.party_style)
    or (old.status = 'cancelled' and new.status <> 'cancelled');

  if schedule_changed and new.status <> 'cancelled' and not importing then
    dow := extract(dow from new.event_date)::smallint;
    if not (dow = any (s.weekdays)) then
      raise exception '% parties are not booked on that day of the week.', s.label
        using errcode = '23514', hint = 'slot_weekday';
    end if;
    if dow = any (s.standard_time_only_weekdays) and not app.is_standard_time(new.event_date, tz) then
      raise exception '% parties on that day are only booked in the winter.', s.label
        using errcode = '23514', hint = 'slot_season';
    end if;
    if v.slot_keys is not null and not (s.key = any (v.slot_keys)) then
      raise exception '% does not take % parties.', v.name, lower(s.label)
        using errcode = '23514', hint = 'venue_slot';
    end if;
    if s.allowed_styles is not null and not (new.party_style = any (s.allowed_styles)) then
      raise exception 'That party style is not offered in the % slot.', lower(s.label)
        using errcode = '23514', hint = 'slot_style';
    end if;
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
  end if;

  if not importing and s.max_guests is not null
     and (new.guests_men + new.guests_women + new.guests_children) > s.max_guests
     and (tg_op = 'INSERT'
          or (new.guests_men + new.guests_women + new.guests_children)
             > (old.guests_men + old.guests_women + old.guests_children)
          or schedule_changed) then
    raise exception '% parties take % guests at most.', s.label, s.max_guests
      using errcode = '23514', hint = 'slot_guests';
  end if;

  -- Paying the deposit turns a hold into a booking.
  if new.deposit_paid and new.status in ('hold', 'expired') then
    new.status := 'booked';
  end if;
  if new.status = 'booked' then
    new.hold_expires_at := null;
  end if;

  if new.status = 'cancelled' and (tg_op = 'INSERT' or old.status <> 'cancelled') then
    new.cancelled_at := now();
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
    new.cancel_reason := null;
  end if;

  -- Free the slot from any hold that already ran out, so it does not block
  -- this save while waiting for the next pg_cron run.
  if new.status in ('hold', 'booked') and new.blocks_slot then
    perform app.expire_holds(new.venue_id, new.event_date, new.slot_id);
  end if;

  return new;
end;
$$;

create function public.admin_import_booking(p jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  org uuid := app.current_org_id();
  paid boolean := coalesce((p->>'deposit_paid')::boolean, false);
begin
  if org is null or not app.has_role('admin') then
    raise exception 'Only admins can import bookings.' using errcode = '42501';
  end if;
  if coalesce(p->>'import_ref', '') = '' then
    raise exception 'Missing calendar reference.' using errcode = '23514';
  end if;
  if exists (select 1 from public.bookings where org_id = org and import_ref = p->>'import_ref') then
    return 'exists';
  end if;
  if not exists (select 1 from public.venues where id = (p->>'venue_id')::uuid and org_id = org) then
    raise exception 'Unknown venue.' using errcode = '23503';
  end if;

  perform set_config('app.importing', 'on', true);
  insert into public.bookings (
    org_id, venue_id, slot_id, event_date, start_minute, duration_minutes, status, hold_expires_at,
    client_first_name, client_last_name, client_phone, client_email,
    other_venue_name, venue_address, party_style,
    guests_men, guests_women, guests_children, notes, menu_notes,
    deposit_paid, deposit_method, deposit_amount_cents, deposit_received_on, import_ref
  ) values (
    org, (p->>'venue_id')::uuid, (p->>'slot_id')::uuid, (p->>'event_date')::date,
    (p->>'start_minute')::smallint, (p->>'duration_minutes')::smallint,
    case when paid then 'booked' else 'hold' end::public.booking_status,
    case when paid then null else now() + interval '7 days' end,
    coalesce(p->>'client_first_name', ''), p->>'client_last_name', p->>'client_phone', nullif(p->>'client_email', ''),
    nullif(p->>'other_venue_name', ''), nullif(p->>'venue_address', ''),
    (p->>'party_style')::public.party_style,
    coalesce((p->>'guests_men')::int, 0), coalesce((p->>'guests_women')::int, 0), coalesce((p->>'guests_children')::int, 0),
    nullif(p->>'notes', ''), nullif(p->>'menu_notes', ''),
    paid,
    case when paid then (p->>'deposit_method')::public.payment_method end,
    case when paid then (p->>'deposit_amount_cents')::int end,
    case when paid then (p->>'deposit_received_on')::date end,
    p->>'import_ref'
  );
  perform set_config('app.importing', 'off', true);
  return 'created';
end;
$$;

revoke all on function public.admin_import_booking(jsonb) from public, anon;
grant execute on function public.admin_import_booking(jsonb) to authenticated;
