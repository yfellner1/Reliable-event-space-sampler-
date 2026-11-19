-- Daily reminder settings.
alter table public.organizations
  add column reminder_enabled boolean not null default false,
  -- Hour of the day (organization's timezone) to send, 0-23.
  add column reminder_hour integer not null default 8 check (reminder_hour between 0 and 23),
  add column reminder_emails text[] not null default '{}',
  -- WhatsApp phone number (digits, with country code) or group chat id.
  add column reminder_whatsapp text,
  add column last_reminder_on date;
