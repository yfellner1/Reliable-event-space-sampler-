-- Days the restaurant takes no parties (yom tov), per organization.
-- evening_only: only the evening slot is closed (Erev, the holiday starts at sundown).
-- The yom tov dates 2026-2045 were generated with scripts/closed-days.ts.
-- A business's setup data calls app.add_yom_tov_closed_days(org id) to load them.

create table public.closed_days (
  org_id uuid not null references public.organizations (id),
  day date not null,
  evening_only boolean not null default false,
  reason text not null,
  primary key (org_id, day)
);
alter table public.closed_days enable row level security;
create policy closed_days_read on public.closed_days for select to authenticated
  using (org_id = app.current_org_id());
create policy closed_days_admin on public.closed_days for all to authenticated
  using (org_id = app.current_org_id() and app.has_role('admin'))
  with check (org_id = app.current_org_id() and app.has_role('admin'));

create function app.add_yom_tov_closed_days(p_org uuid) returns void
language sql security definer set search_path = ''
as $fn$
insert into public.closed_days (org_id, day, evening_only, reason)
select p_org, v.day::date, v.evening_only, v.reason
from (values
  ('2026-04-01', true, 'Erev Pesach'),
  ('2026-04-02', false, 'Pesach'),
  ('2026-04-03', false, 'Pesach'),
  ('2026-04-04', false, 'Pesach'),
  ('2026-04-05', false, 'Pesach'),
  ('2026-04-06', false, 'Pesach'),
  ('2026-04-07', false, 'Pesach'),
  ('2026-04-08', false, 'Pesach'),
  ('2026-04-09', false, 'Pesach'),
  ('2026-05-21', true, 'Erev Shavuot'),
  ('2026-05-22', false, 'Shavuot'),
  ('2026-05-23', false, 'Shavuot'),
  ('2026-09-11', true, 'Erev Rosh Hashanah'),
  ('2026-09-12', false, 'Rosh Hashanah'),
  ('2026-09-13', false, 'Rosh Hashanah'),
  ('2026-09-20', true, 'Erev Yom Kippur'),
  ('2026-09-21', false, 'Yom Kippur'),
  ('2026-09-25', true, 'Erev Sukkot'),
  ('2026-09-26', false, 'Sukkot'),
  ('2026-09-27', false, 'Sukkot'),
  ('2027-04-21', true, 'Erev Pesach'),
  ('2027-04-22', false, 'Pesach'),
  ('2027-04-23', false, 'Pesach'),
  ('2027-04-24', false, 'Pesach'),
  ('2027-04-25', false, 'Pesach'),
  ('2027-04-26', false, 'Pesach'),
  ('2027-04-27', false, 'Pesach'),
  ('2027-04-28', false, 'Pesach'),
  ('2027-04-29', false, 'Pesach'),
  ('2027-06-10', true, 'Erev Shavuot'),
  ('2027-06-11', false, 'Shavuot'),
  ('2027-06-12', false, 'Shavuot'),
  ('2027-10-01', true, 'Erev Rosh Hashanah'),
  ('2027-10-02', false, 'Rosh Hashanah'),
  ('2027-10-03', false, 'Rosh Hashanah'),
  ('2027-10-10', true, 'Erev Yom Kippur'),
  ('2027-10-11', false, 'Yom Kippur'),
  ('2027-10-15', true, 'Erev Sukkot'),
  ('2027-10-16', false, 'Sukkot'),
  ('2027-10-17', false, 'Sukkot'),
  ('2028-04-10', true, 'Erev Pesach'),
  ('2028-04-11', false, 'Pesach'),
  ('2028-04-12', false, 'Pesach'),
  ('2028-04-13', false, 'Pesach'),
  ('2028-04-14', false, 'Pesach'),
  ('2028-04-15', false, 'Pesach'),
  ('2028-04-16', false, 'Pesach'),
  ('2028-04-17', false, 'Pesach'),
  ('2028-04-18', false, 'Pesach'),
  ('2028-05-30', true, 'Erev Shavuot'),
  ('2028-05-31', false, 'Shavuot'),
  ('2028-06-01', false, 'Shavuot'),
  ('2028-09-20', true, 'Erev Rosh Hashanah'),
  ('2028-09-21', false, 'Rosh Hashanah'),
  ('2028-09-22', false, 'Rosh Hashanah'),
  ('2028-09-29', true, 'Erev Yom Kippur'),
  ('2028-09-30', false, 'Yom Kippur'),
  ('2028-10-04', true, 'Erev Sukkot'),
  ('2028-10-05', false, 'Sukkot'),
  ('2028-10-06', false, 'Sukkot'),
  ('2029-03-30', true, 'Erev Pesach'),
  ('2029-03-31', false, 'Pesach'),
  ('2029-04-01', false, 'Pesach'),
  ('2029-04-02', false, 'Pesach'),
  ('2029-04-03', false, 'Pesach'),
  ('2029-04-04', false, 'Pesach'),
  ('2029-04-05', false, 'Pesach'),
  ('2029-04-06', false, 'Pesach'),
  ('2029-04-07', false, 'Pesach'),
  ('2029-05-19', true, 'Erev Shavuot'),
  ('2029-05-20', false, 'Shavuot'),
  ('2029-05-21', false, 'Shavuot'),
  ('2029-09-09', true, 'Erev Rosh Hashanah'),
  ('2029-09-10', false, 'Rosh Hashanah'),
  ('2029-09-11', false, 'Rosh Hashanah'),
  ('2029-09-18', true, 'Erev Yom Kippur'),
  ('2029-09-19', false, 'Yom Kippur'),
  ('2029-09-23', true, 'Erev Sukkot'),
  ('2029-09-24', false, 'Sukkot'),
  ('2029-09-25', false, 'Sukkot'),
  ('2030-04-17', true, 'Erev Pesach'),
  ('2030-04-18', false, 'Pesach'),
  ('2030-04-19', false, 'Pesach'),
  ('2030-04-20', false, 'Pesach'),
  ('2030-04-21', false, 'Pesach'),
  ('2030-04-22', false, 'Pesach'),
  ('2030-04-23', false, 'Pesach'),
  ('2030-04-24', false, 'Pesach'),
  ('2030-04-25', false, 'Pesach'),
  ('2030-06-06', true, 'Erev Shavuot'),
  ('2030-06-07', false, 'Shavuot'),
  ('2030-06-08', false, 'Shavuot'),
  ('2030-09-27', true, 'Erev Rosh Hashanah'),
  ('2030-09-28', false, 'Rosh Hashanah'),
  ('2030-09-29', false, 'Rosh Hashanah'),
  ('2030-10-06', true, 'Erev Yom Kippur'),
  ('2030-10-07', false, 'Yom Kippur'),
  ('2030-10-11', true, 'Erev Sukkot'),
  ('2030-10-12', false, 'Sukkot'),
  ('2030-10-13', false, 'Sukkot'),
  ('2031-04-07', true, 'Erev Pesach'),
  ('2031-04-08', false, 'Pesach'),
  ('2031-04-09', false, 'Pesach'),
  ('2031-04-10', false, 'Pesach'),
  ('2031-04-11', false, 'Pesach'),
  ('2031-04-12', false, 'Pesach'),
  ('2031-04-13', false, 'Pesach'),
  ('2031-04-14', false, 'Pesach'),
  ('2031-04-15', false, 'Pesach'),
  ('2031-05-27', true, 'Erev Shavuot'),
  ('2031-05-28', false, 'Shavuot'),
  ('2031-05-29', false, 'Shavuot'),
  ('2031-09-17', true, 'Erev Rosh Hashanah'),
  ('2031-09-18', false, 'Rosh Hashanah'),
  ('2031-09-19', false, 'Rosh Hashanah'),
  ('2031-09-26', true, 'Erev Yom Kippur'),
  ('2031-09-27', false, 'Yom Kippur'),
  ('2031-10-01', true, 'Erev Sukkot'),
  ('2031-10-02', false, 'Sukkot'),
  ('2031-10-03', false, 'Sukkot'),
  ('2032-03-26', true, 'Erev Pesach'),
  ('2032-03-27', false, 'Pesach'),
  ('2032-03-28', false, 'Pesach'),
  ('2032-03-29', false, 'Pesach'),
  ('2032-03-30', false, 'Pesach'),
  ('2032-03-31', false, 'Pesach'),
  ('2032-04-01', false, 'Pesach'),
  ('2032-04-02', false, 'Pesach'),
  ('2032-04-03', false, 'Pesach'),
  ('2032-05-15', true, 'Erev Shavuot'),
  ('2032-05-16', false, 'Shavuot'),
  ('2032-05-17', false, 'Shavuot'),
  ('2032-09-05', true, 'Erev Rosh Hashanah'),
  ('2032-09-06', false, 'Rosh Hashanah'),
  ('2032-09-07', false, 'Rosh Hashanah'),
  ('2032-09-14', true, 'Erev Yom Kippur'),
  ('2032-09-15', false, 'Yom Kippur'),
  ('2032-09-19', true, 'Erev Sukkot'),
  ('2032-09-20', false, 'Sukkot'),
  ('2032-09-21', false, 'Sukkot'),
  ('2033-04-13', true, 'Erev Pesach'),
  ('2033-04-14', false, 'Pesach'),
  ('2033-04-15', false, 'Pesach'),
  ('2033-04-16', false, 'Pesach'),
  ('2033-04-17', false, 'Pesach'),
  ('2033-04-18', false, 'Pesach'),
  ('2033-04-19', false, 'Pesach'),
  ('2033-04-20', false, 'Pesach'),
  ('2033-04-21', false, 'Pesach'),
  ('2033-06-02', true, 'Erev Shavuot'),
  ('2033-06-03', false, 'Shavuot'),
  ('2033-06-04', false, 'Shavuot'),
  ('2033-09-23', true, 'Erev Rosh Hashanah'),
  ('2033-09-24', false, 'Rosh Hashanah'),
  ('2033-09-25', false, 'Rosh Hashanah'),
  ('2033-10-02', true, 'Erev Yom Kippur'),
  ('2033-10-03', false, 'Yom Kippur'),
  ('2033-10-07', true, 'Erev Sukkot'),
  ('2033-10-08', false, 'Sukkot'),
  ('2033-10-09', false, 'Sukkot'),
  ('2034-04-03', true, 'Erev Pesach'),
  ('2034-04-04', false, 'Pesach'),
  ('2034-04-05', false, 'Pesach'),
  ('2034-04-06', false, 'Pesach'),
  ('2034-04-07', false, 'Pesach'),
  ('2034-04-08', false, 'Pesach'),
  ('2034-04-09', false, 'Pesach'),
  ('2034-04-10', false, 'Pesach'),
  ('2034-04-11', false, 'Pesach'),
  ('2034-05-23', true, 'Erev Shavuot'),
  ('2034-05-24', false, 'Shavuot'),
  ('2034-05-25', false, 'Shavuot'),
  ('2034-09-13', true, 'Erev Rosh Hashanah'),
  ('2034-09-14', false, 'Rosh Hashanah'),
  ('2034-09-15', false, 'Rosh Hashanah'),
  ('2034-09-22', true, 'Erev Yom Kippur'),
  ('2034-09-23', false, 'Yom Kippur'),
  ('2034-09-27', true, 'Erev Sukkot'),
  ('2034-09-28', false, 'Sukkot'),
  ('2034-09-29', false, 'Sukkot'),
  ('2035-04-23', true, 'Erev Pesach'),
  ('2035-04-24', false, 'Pesach'),
  ('2035-04-25', false, 'Pesach'),
  ('2035-04-26', false, 'Pesach'),
  ('2035-04-27', false, 'Pesach'),
  ('2035-04-28', false, 'Pesach'),
  ('2035-04-29', false, 'Pesach'),
  ('2035-04-30', false, 'Pesach'),
  ('2035-05-01', false, 'Pesach'),
  ('2035-06-12', true, 'Erev Shavuot'),
  ('2035-06-13', false, 'Shavuot'),
  ('2035-06-14', false, 'Shavuot'),
  ('2035-10-03', true, 'Erev Rosh Hashanah'),
  ('2035-10-04', false, 'Rosh Hashanah'),
  ('2035-10-05', false, 'Rosh Hashanah'),
  ('2035-10-12', true, 'Erev Yom Kippur'),
  ('2035-10-13', false, 'Yom Kippur'),
  ('2035-10-17', true, 'Erev Sukkot'),
  ('2035-10-18', false, 'Sukkot'),
  ('2035-10-19', false, 'Sukkot'),
  ('2036-04-11', true, 'Erev Pesach'),
  ('2036-04-12', false, 'Pesach'),
  ('2036-04-13', false, 'Pesach'),
  ('2036-04-14', false, 'Pesach'),
  ('2036-04-15', false, 'Pesach'),
  ('2036-04-16', false, 'Pesach'),
  ('2036-04-17', false, 'Pesach'),
  ('2036-04-18', false, 'Pesach'),
  ('2036-04-19', false, 'Pesach'),
  ('2036-05-31', true, 'Erev Shavuot'),
  ('2036-06-01', false, 'Shavuot'),
  ('2036-06-02', false, 'Shavuot'),
  ('2036-09-21', true, 'Erev Rosh Hashanah'),
  ('2036-09-22', false, 'Rosh Hashanah'),
  ('2036-09-23', false, 'Rosh Hashanah'),
  ('2036-09-30', true, 'Erev Yom Kippur'),
  ('2036-10-01', false, 'Yom Kippur'),
  ('2036-10-05', true, 'Erev Sukkot'),
  ('2036-10-06', false, 'Sukkot'),
  ('2036-10-07', false, 'Sukkot'),
  ('2037-03-30', true, 'Erev Pesach'),
  ('2037-03-31', false, 'Pesach'),
  ('2037-04-01', false, 'Pesach'),
  ('2037-04-02', false, 'Pesach'),
  ('2037-04-03', false, 'Pesach'),
  ('2037-04-04', false, 'Pesach'),
  ('2037-04-05', false, 'Pesach'),
  ('2037-04-06', false, 'Pesach'),
  ('2037-04-07', false, 'Pesach'),
  ('2037-05-19', true, 'Erev Shavuot'),
  ('2037-05-20', false, 'Shavuot'),
  ('2037-05-21', false, 'Shavuot'),
  ('2037-09-09', true, 'Erev Rosh Hashanah'),
  ('2037-09-10', false, 'Rosh Hashanah'),
  ('2037-09-11', false, 'Rosh Hashanah'),
  ('2037-09-18', true, 'Erev Yom Kippur'),
  ('2037-09-19', false, 'Yom Kippur'),
  ('2037-09-23', true, 'Erev Sukkot'),
  ('2037-09-24', false, 'Sukkot'),
  ('2037-09-25', false, 'Sukkot'),
  ('2038-04-19', true, 'Erev Pesach'),
  ('2038-04-20', false, 'Pesach'),
  ('2038-04-21', false, 'Pesach'),
  ('2038-04-22', false, 'Pesach'),
  ('2038-04-23', false, 'Pesach'),
  ('2038-04-24', false, 'Pesach'),
  ('2038-04-25', false, 'Pesach'),
  ('2038-04-26', false, 'Pesach'),
  ('2038-04-27', false, 'Pesach'),
  ('2038-06-08', true, 'Erev Shavuot'),
  ('2038-06-09', false, 'Shavuot'),
  ('2038-06-10', false, 'Shavuot'),
  ('2038-09-29', true, 'Erev Rosh Hashanah'),
  ('2038-09-30', false, 'Rosh Hashanah'),
  ('2038-10-01', false, 'Rosh Hashanah'),
  ('2038-10-08', true, 'Erev Yom Kippur'),
  ('2038-10-09', false, 'Yom Kippur'),
  ('2038-10-13', true, 'Erev Sukkot'),
  ('2038-10-14', false, 'Sukkot'),
  ('2038-10-15', false, 'Sukkot'),
  ('2039-04-08', true, 'Erev Pesach'),
  ('2039-04-09', false, 'Pesach'),
  ('2039-04-10', false, 'Pesach'),
  ('2039-04-11', false, 'Pesach'),
  ('2039-04-12', false, 'Pesach'),
  ('2039-04-13', false, 'Pesach'),
  ('2039-04-14', false, 'Pesach'),
  ('2039-04-15', false, 'Pesach'),
  ('2039-04-16', false, 'Pesach'),
  ('2039-05-28', true, 'Erev Shavuot'),
  ('2039-05-29', false, 'Shavuot'),
  ('2039-05-30', false, 'Shavuot'),
  ('2039-09-18', true, 'Erev Rosh Hashanah'),
  ('2039-09-19', false, 'Rosh Hashanah'),
  ('2039-09-20', false, 'Rosh Hashanah'),
  ('2039-09-27', true, 'Erev Yom Kippur'),
  ('2039-09-28', false, 'Yom Kippur'),
  ('2039-10-02', true, 'Erev Sukkot'),
  ('2039-10-03', false, 'Sukkot'),
  ('2039-10-04', false, 'Sukkot'),
  ('2040-03-28', true, 'Erev Pesach'),
  ('2040-03-29', false, 'Pesach'),
  ('2040-03-30', false, 'Pesach'),
  ('2040-03-31', false, 'Pesach'),
  ('2040-04-01', false, 'Pesach'),
  ('2040-04-02', false, 'Pesach'),
  ('2040-04-03', false, 'Pesach'),
  ('2040-04-04', false, 'Pesach'),
  ('2040-04-05', false, 'Pesach'),
  ('2040-05-17', true, 'Erev Shavuot'),
  ('2040-05-18', false, 'Shavuot'),
  ('2040-05-19', false, 'Shavuot'),
  ('2040-09-07', true, 'Erev Rosh Hashanah'),
  ('2040-09-08', false, 'Rosh Hashanah'),
  ('2040-09-09', false, 'Rosh Hashanah'),
  ('2040-09-16', true, 'Erev Yom Kippur'),
  ('2040-09-17', false, 'Yom Kippur'),
  ('2040-09-21', true, 'Erev Sukkot'),
  ('2040-09-22', false, 'Sukkot'),
  ('2040-09-23', false, 'Sukkot'),
  ('2041-04-15', true, 'Erev Pesach'),
  ('2041-04-16', false, 'Pesach'),
  ('2041-04-17', false, 'Pesach'),
  ('2041-04-18', false, 'Pesach'),
  ('2041-04-19', false, 'Pesach'),
  ('2041-04-20', false, 'Pesach'),
  ('2041-04-21', false, 'Pesach'),
  ('2041-04-22', false, 'Pesach'),
  ('2041-04-23', false, 'Pesach'),
  ('2041-06-04', true, 'Erev Shavuot'),
  ('2041-06-05', false, 'Shavuot'),
  ('2041-06-06', false, 'Shavuot'),
  ('2041-09-25', true, 'Erev Rosh Hashanah'),
  ('2041-09-26', false, 'Rosh Hashanah'),
  ('2041-09-27', false, 'Rosh Hashanah'),
  ('2041-10-04', true, 'Erev Yom Kippur'),
  ('2041-10-05', false, 'Yom Kippur'),
  ('2041-10-09', true, 'Erev Sukkot'),
  ('2041-10-10', false, 'Sukkot'),
  ('2041-10-11', false, 'Sukkot'),
  ('2042-04-04', true, 'Erev Pesach'),
  ('2042-04-05', false, 'Pesach'),
  ('2042-04-06', false, 'Pesach'),
  ('2042-04-07', false, 'Pesach'),
  ('2042-04-08', false, 'Pesach'),
  ('2042-04-09', false, 'Pesach'),
  ('2042-04-10', false, 'Pesach'),
  ('2042-04-11', false, 'Pesach'),
  ('2042-04-12', false, 'Pesach'),
  ('2042-05-24', true, 'Erev Shavuot'),
  ('2042-05-25', false, 'Shavuot'),
  ('2042-05-26', false, 'Shavuot'),
  ('2042-09-14', true, 'Erev Rosh Hashanah'),
  ('2042-09-15', false, 'Rosh Hashanah'),
  ('2042-09-16', false, 'Rosh Hashanah'),
  ('2042-09-23', true, 'Erev Yom Kippur'),
  ('2042-09-24', false, 'Yom Kippur'),
  ('2042-09-28', true, 'Erev Sukkot'),
  ('2042-09-29', false, 'Sukkot'),
  ('2042-09-30', false, 'Sukkot'),
  ('2043-04-24', true, 'Erev Pesach'),
  ('2043-04-25', false, 'Pesach'),
  ('2043-04-26', false, 'Pesach'),
  ('2043-04-27', false, 'Pesach'),
  ('2043-04-28', false, 'Pesach'),
  ('2043-04-29', false, 'Pesach'),
  ('2043-04-30', false, 'Pesach'),
  ('2043-05-01', false, 'Pesach'),
  ('2043-05-02', false, 'Pesach'),
  ('2043-06-13', true, 'Erev Shavuot'),
  ('2043-06-14', false, 'Shavuot'),
  ('2043-06-15', false, 'Shavuot'),
  ('2043-10-04', true, 'Erev Rosh Hashanah'),
  ('2043-10-05', false, 'Rosh Hashanah'),
  ('2043-10-06', false, 'Rosh Hashanah'),
  ('2043-10-13', true, 'Erev Yom Kippur'),
  ('2043-10-14', false, 'Yom Kippur'),
  ('2043-10-18', true, 'Erev Sukkot'),
  ('2043-10-19', false, 'Sukkot'),
  ('2043-10-20', false, 'Sukkot'),
  ('2044-04-11', true, 'Erev Pesach'),
  ('2044-04-12', false, 'Pesach'),
  ('2044-04-13', false, 'Pesach'),
  ('2044-04-14', false, 'Pesach'),
  ('2044-04-15', false, 'Pesach'),
  ('2044-04-16', false, 'Pesach'),
  ('2044-04-17', false, 'Pesach'),
  ('2044-04-18', false, 'Pesach'),
  ('2044-04-19', false, 'Pesach'),
  ('2044-05-31', true, 'Erev Shavuot'),
  ('2044-06-01', false, 'Shavuot'),
  ('2044-06-02', false, 'Shavuot'),
  ('2044-09-21', true, 'Erev Rosh Hashanah'),
  ('2044-09-22', false, 'Rosh Hashanah'),
  ('2044-09-23', false, 'Rosh Hashanah'),
  ('2044-09-30', true, 'Erev Yom Kippur'),
  ('2044-10-01', false, 'Yom Kippur'),
  ('2044-10-05', true, 'Erev Sukkot'),
  ('2044-10-06', false, 'Sukkot'),
  ('2044-10-07', false, 'Sukkot'),
  ('2045-04-01', true, 'Erev Pesach'),
  ('2045-04-02', false, 'Pesach'),
  ('2045-04-03', false, 'Pesach'),
  ('2045-04-04', false, 'Pesach'),
  ('2045-04-05', false, 'Pesach'),
  ('2045-04-06', false, 'Pesach'),
  ('2045-04-07', false, 'Pesach'),
  ('2045-04-08', false, 'Pesach'),
  ('2045-04-09', false, 'Pesach'),
  ('2045-05-21', true, 'Erev Shavuot'),
  ('2045-05-22', false, 'Shavuot'),
  ('2045-05-23', false, 'Shavuot'),
  ('2045-09-11', true, 'Erev Rosh Hashanah'),
  ('2045-09-12', false, 'Rosh Hashanah'),
  ('2045-09-13', false, 'Rosh Hashanah'),
  ('2045-09-20', true, 'Erev Yom Kippur'),
  ('2045-09-21', false, 'Yom Kippur'),
  ('2045-09-25', true, 'Erev Sukkot'),
  ('2045-09-26', false, 'Sukkot'),
  ('2045-09-27', false, 'Sukkot')
) as v (day, evening_only, reason)
on conflict do nothing;
$fn$;
revoke all on function app.add_yom_tov_closed_days(uuid) from public;


-- Bookings can't be made on a closed day (the check runs with the other schedule rules).
create or replace function app.bookings_before_write() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v public.venues%rowtype;
  s public.slots%rowtype;
  tz text;
  dow smallint;
  schedule_changed boolean;
  closed_reason text;
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
    select reason into closed_reason from public.closed_days c
    where c.org_id = v.org_id and c.day = new.event_date and (not c.evening_only or s.key = 'evening');
    if found then
      raise exception 'Closed for %.', closed_reason using errcode = '23514', hint = 'closed_day';
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
