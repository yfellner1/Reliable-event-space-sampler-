-- Member management for admins.
--
-- Login accounts (auth.users) are created by the server with the secret key.
-- The profile row that gives an account its organization and role is written
-- through these functions, called as the admin, so the audit log records which
-- admin made each change.

create function public.admin_add_member(
  p_user_id uuid,
  p_username text,
  p_display_name text,
  p_role public.member_role
) returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  org uuid := app.current_org_id();
  result public.profiles;
begin
  if org is null or not app.has_role('admin') then
    raise exception 'Only admins can add users.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Unknown login account.' using errcode = '23503';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'That login already belongs to a user.' using errcode = '23505';
  end if;

  insert into public.profiles (id, org_id, username, display_name, role)
  values (p_user_id, org, lower(btrim(p_username)), btrim(p_display_name), p_role)
  returning * into result;
  return result;
end;
$$;

create function public.admin_update_member(
  p_user_id uuid,
  p_display_name text,
  p_role public.member_role,
  p_active boolean
) returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  org uuid := app.current_org_id();
  result public.profiles;
begin
  if org is null or not app.has_role('admin') then
    raise exception 'Only admins can change users.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'admin' or not p_active) then
    raise exception 'You cannot remove your own admin access.' using errcode = 'P0001',
      hint = 'self_demote';
  end if;

  update public.profiles
     set display_name = btrim(p_display_name),
         role = p_role,
         active = p_active
   where id = p_user_id and org_id = org
  returning * into result;

  if result.id is null then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.admin_add_member(uuid, text, text, public.member_role) from public, anon;
revoke all on function public.admin_update_member(uuid, text, public.member_role, boolean) from public, anon;
grant execute on function public.admin_add_member(uuid, text, text, public.member_role) to authenticated;
grant execute on function public.admin_update_member(uuid, text, public.member_role, boolean) to authenticated;
