-- Schedule rules as data, enforced by the bookings trigger.
--
--   slots.weekdays                   days of the week the slot runs (0 = Sunday)
--   slots.standard_time_only_weekdays days that run only in winter (standard time)
--   slots.allowed_styles             party styles allowed in the slot (null = any)
--   slots.max_guests                 guest limit for the slot (null = none)
--   venues.slot_keys                 slots the venue offers (null = all)
--   organizations.hold_hours         how long an editor's hold lasts
--   organizations.deposit_cents      the standard deposit

alter table public.organizations
  add column hold_hours integer not null default 48 check (hold_hours between 1 and 720),
  add column deposit_cents integer not null default 40000 check (deposit_cents > 0);

alter table public.slots
  add column weekdays smallint[] not null default '{0,1,2,3,4,5,6}'
    check (weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  add column standard_time_only_weekdays smallint[] not null default '{}'
    check (standard_time_only_weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  add column allowed_styles public.party_style[],
  add column max_guests integer check (max_guests is null or max_guests > 0);

alter table public.venues
  add column slot_keys text[];

-- Each business sets its own rules in its setup data (see the sample business
-- migration at the end of this folder).

-- True when the date falls in standard (winter) time in the given timezone.
-- Standard time is the half of the year with the smaller UTC offset
-- (New York: UTC-5 in winter, UTC-4 in summer).
create function app.utc_offset(d date, tz text) returns interval
language sql stable set search_path = ''
as $$
  -- Local wall-clock time at 17:00 UTC on that date, minus 17:00.
  select (((d + time '17:00') at time zone 'UTC') at time zone tz) - (d + time '17:00')
$$;

create function app.is_standard_time(d date, tz text) returns boolean
language sql stable set search_path = ''
as $$
  select app.utc_offset(d, tz) = least(
    app.utc_offset(make_date(extract(year from d)::int, 1, 1), tz),
    app.utc_offset(make_date(extract(year from d)::int, 7, 1), tz)
  )
$$;

create or replace function app.bookings_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v public.venues%rowtype;
  s public.slots%rowtype;
  tz text;
  dow smallint;
  schedule_changed boolean;
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

  -- Schedule rules are checked when a booking is made or its timing changes,
  -- so a later change to the rules never blocks editing an existing booking.
  schedule_changed := tg_op = 'INSERT'
    or (new.venue_id, new.slot_id, new.event_date, new.start_minute, new.duration_minutes, new.party_style)
       is distinct from
       (old.venue_id, old.slot_id, old.event_date, old.start_minute, old.duration_minutes, old.party_style)
    or (old.status = 'cancelled' and new.status <> 'cancelled');

  if schedule_changed and new.status <> 'cancelled' then
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

  if s.max_guests is not null
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
