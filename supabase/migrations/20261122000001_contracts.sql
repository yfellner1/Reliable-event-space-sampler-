-- Contracts: the terms printed on the contract PDF (editable by admins), and
-- private storage for signed copies.

alter table public.organizations add column contract_terms text;

-- Each business writes its own terms in Settings (the sample business sets some).


-- Private bucket. Files are stored under <org id>/<booking id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts', 'contracts', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

-- Only editors and admins of the organization that owns the folder.
create policy contracts_select on storage.objects for select to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = app.current_org_id()::text
    and app.has_role('admin', 'editor')
  );
create policy contracts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = app.current_org_id()::text
    and app.has_role('admin', 'editor')
  );
create policy contracts_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = app.current_org_id()::text
    and app.has_role('admin')
  );
