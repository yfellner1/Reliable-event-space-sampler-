-- What was last posted to the WhatsApp group for each booking, so the app can
-- tell when the group chat no longer matches the booking.

alter table public.bookings
  add column whatsapp_posted_text text,
  add column whatsapp_posted_at timestamptz,
  add column whatsapp_posted_by uuid references public.profiles (id);

-- Recording a post is not an edit of the booking: keep the "last edited by"
-- fields as they were when only these columns change.
create function app.bookings_keep_editor_on_post() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (to_jsonb(new) - '{whatsapp_posted_text,whatsapp_posted_at,whatsapp_posted_by,updated_by,updated_at}'::text[])
     = (to_jsonb(old) - '{whatsapp_posted_text,whatsapp_posted_at,whatsapp_posted_by,updated_by,updated_at}'::text[]) then
    new.updated_by := old.updated_by;
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- Runs after bookings_before_write (triggers fire in name order).
create trigger bookings_zz_keep_editor_on_post before update on public.bookings
  for each row execute function app.bookings_keep_editor_on_post();
