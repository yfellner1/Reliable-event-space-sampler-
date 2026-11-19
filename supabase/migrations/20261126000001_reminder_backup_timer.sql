-- A second hourly timer for the daily reminder, run by the database itself
-- (pg_cron + pg_net), so the reminder doesn't depend only on Vercel's cron.
-- Both call the same endpoint; it sends at most once a day.
-- The endpoint address and its secret are written by the production build
-- (scripts/vercel-prebuild.ts) into app.job_settings, which no app user can read.

create table if not exists app.job_settings (
  key text primary key,
  value text not null
);
revoke all on app.job_settings from public, anon, authenticated;

create or replace function app.call_reminder_job() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  url text := (select value from app.job_settings where key = 'reminder_url');
  secret text := (select value from app.job_settings where key = 'cron_secret');
begin
  if url is null or secret is null then
    return;
  end if;
  perform net.http_get(
    url := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function app.call_reminder_job() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension if not exists pg_net;
    perform cron.schedule('daily-reminder', '7 * * * *', 'select app.call_reminder_job()');
  end if;
end;
$$;
