-- SAMPLE BUSINESS: The Green Bowl (kosher outside catering, Lakewood NJ).
--
-- Everything that is specific to one business lives in this one file: the
-- business profile, where and when it works, its menus and prices, contract
-- terms, and a handful of sample bookings for demos. To set the app up for a
-- different business, replace this file (or change everything in Settings and
-- Menus after launch).
--
-- Prices come from Green Bowl's Bris package sheet and its online menu
-- (Nov 2026). Prices marked SAMPLE are placeholders to confirm with the client.
-- Times are minutes after midnight in America/New_York. Money is in cents.

-- ---------------------------------------------------------------------------
-- The business
-- ---------------------------------------------------------------------------

insert into public.organizations (
  id, slug, name, timezone, tagline, phone, email, website, address, brand_color,
  occasions, sales_tax_percent, waiter_rate_cents, waiter_min, waiter_hours_included,
  deposit_cents, hold_hours
)
values (
  '00000000-0000-4000-8000-000000006b01', 'green-bowl', 'The Green Bowl', 'America/New_York',
  'Kosher catering for every simcha', '732-886-2531', 'orders@gbsalad.com', 'gbsalad.com',
  '18 S Clifton Ave, Lakewood, NJ 08701', '#1F4D2E',
  '{bris,melava_malka,shalosh_seudos,bat_mitzvah,upsherin,kiddush,vort,other}',
  6.625, 12500, 2, 4,
  50000, 72
)
on conflict (id) do nothing;

-- Green Bowl has no hall: every job is at the client's address. Several jobs
-- can go out at the same time, so the location doesn't block the time slot.
insert into public.venues (org_id, name, code, color, kind, exclusive, extra_fee_cents, sort_order)
values
  ('00000000-0000-4000-8000-000000006b01', 'Delivery & setup', 'D', '#1F4D2E', 'catering', false, 0, 1)
on conflict (org_id, name) do nothing;

-- Morning (brises, Sunday to Friday), afternoon (kiddush, bat mitzvah,
-- upsherin, shalosh seudos: any day), evening (melava malka on Motzei
-- Shabbos, other parties Sunday to Thursday). Waiters are booked for up to
-- four hours.
insert into public.slots (org_id, key, label, start_earliest, start_latest, end_latest, max_minutes, sort_order, weekdays)
values
  ('00000000-0000-4000-8000-000000006b01', 'morning', 'Morning', 390, 600, 840, 240, 1, '{0,1,2,3,4,5}'),
  ('00000000-0000-4000-8000-000000006b01', 'afternoon', 'Afternoon', 690, 960, null, 240, 2, '{0,1,2,3,4,5,6}'),
  ('00000000-0000-4000-8000-000000006b01', 'evening', 'Evening', 1050, 1290, 1440, 240, 3, '{0,1,2,3,4,6}')
on conflict (org_id, key) do nothing;

-- Closed on yom tov.
select app.add_yom_tov_closed_days('00000000-0000-4000-8000-000000006b01');

update public.organizations
set contract_terms = $terms$MENU
The menu shown on this contract is the official reference for the food served. Changes to the menu are accepted up to five (5) days before the event.

GUEST COUNT
The Client will give the final number of adults and children at least three (3) days before the event. The Client is billed for the menu's minimum when fewer guests attend.

WAITERS
Waiters are charged per waiter for up to four (4) hours, with a minimum of two (2) waiters for served events.

DELIVERY AND SETUP
The Client provides access to the location at least one hour before the event start time. Delivery is available for an additional fee, shown in the estimate.

PRICES AND TAX
All prices are subject to change until this contract is signed. All items are subject to New Jersey sales tax.

DEPOSIT AND PAYMENT
A deposit is due when this contract is signed and reserves the date. The balance is due on the day of the event.$terms$
where id = '00000000-0000-4000-8000-000000006b01';

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------

create function pg_temp.sec(
  p_menu uuid, p_name text, p_sort int, p_min int, p_max int,
  p_note text default null, p_included int default null, p_extra int default null
) returns uuid language sql as $$
  insert into public.menu_sections (org_id, menu_id, name, note, min_choices, max_choices, included_choices, extra_choice_price_cents, sort_order)
  values ('00000000-0000-4000-8000-000000006b01', p_menu, p_name, p_note, p_min, p_max, p_included, p_extra, p_sort)
  returning id;
$$;

create function pg_temp.item(
  p_section uuid, p_sort int, p_name text, p_price int default 0, p_unit text default 'per_person',
  p_unit_label text default null, p_choice_count int default null, p_options text[] default null,
  p_included boolean default false
) returns uuid language sql as $$
  insert into public.menu_items (org_id, section_id, name, included, price_cents, price_unit, unit_label, choice_count, choice_options, sort_order)
  values ('00000000-0000-4000-8000-000000006b01', p_section, p_name, p_included, p_price,
          p_unit::public.menu_price_unit, p_unit_label, p_choice_count, p_options, p_sort)
  returning id;
$$;

do $$
declare
  org constant uuid := '00000000-0000-4000-8000-000000006b01';
  m uuid;
  s uuid;
  salads constant text[] := '{GB Caesar,Classic portobello,Sesame crunch (nish nosh),Seasonal fruity lettuce,Toffee peanut,BBQ corn romaine,Sweet chef,Taco crunch,Garlic basil garden (sugar free),Lemon zest garden (sugar free)}';
begin
  -- Bris package: $15 per adult (75 minimum), $10 per child (10 minimum).
  insert into public.menus (org_id, name, styles, occasions, pricing, base_price_cents, min_guests, child_price_cents, min_children,
                            gratuity_percent, child_price_percent, guests_per_table, included_note, sort_order)
  values (org, 'Bris package', '{plated,family,buffet}', '{bris}', 'per_person', 1500, 75, 1000, 10, 0, 100, 10,
    'Adults'' tables (10 per table): cloth tablecloth, paper goods, iced coffee, water and orange juice, assorted bagels and rolls (bagels, mini baguettes, mini pretzel rolls, whole wheat rolls), men''s spread platter (tuna deluxe, fresh lox, white fish), ladies'' spread platter (tuna deluxe, fresh lox, guacamole), cream cheese, Israeli salad, pastry and donut platters. Children''s tables: cloth tablecloth, paper goods, cereal and milk, bagel platter, cream cheese, butter, donut platter, water, orange juice and chocolate milk. Buffet table: take-along precut foil and bags, hot coffee station, extra pastry platter.',
    1)
  returning id into m;

  s := pg_temp.sec(m, 'Romaine lettuce salads', 1, 2, null, 'For the buffet table', 2, 100); -- extra salad: SAMPLE +$1 pp
  perform pg_temp.item(s, 1, 'GB Caesar');
  perform pg_temp.item(s, 2, 'GB Caesar (dairy)');
  perform pg_temp.item(s, 3, 'Greek salad');
  perform pg_temp.item(s, 4, 'Fruity salad');
  perform pg_temp.item(s, 5, 'Sesame crunch');
  perform pg_temp.item(s, 6, 'Garlic basil');

  s := pg_temp.sec(m, 'Table upgrades', 2, 0, null, 'Optional');
  perform pg_temp.item(s, 1, 'Hard white plates and cutlery', 300);
  perform pg_temp.item(s, 2, 'Fresh melon entrée', 600);
  perform pg_temp.item(s, 3, 'Egg salad', 1500, 'per_table', 'table');
  perform pg_temp.item(s, 4, 'Quinoa salad', 2000, 'per_table', 'table');

  s := pg_temp.sec(m, 'Hot buffet', 3, 0, null, 'Optional · 9x13 pans · sterno included with 2 or more hot dishes');
  perform pg_temp.item(s, 1, 'Pancakes and syrup', 6500, 'per_unit', 'pan');
  perform pg_temp.item(s, 2, 'Cheese blintzes', 4800, 'per_unit', 'dozen');
  perform pg_temp.item(s, 3, 'Mini quiches', 4500, 'per_unit', 'dozen');
  perform pg_temp.item(s, 4, 'Potato kugel', 4500, 'per_unit', 'pan');
  perform pg_temp.item(s, 5, 'Hash browns', 6000, 'per_unit', 'pan');
  perform pg_temp.item(s, 6, 'French fries', 4000, 'per_unit', 'pan');
  perform pg_temp.item(s, 7, 'Scrambled eggs', 6500, 'per_unit', 'pan');
  perform pg_temp.item(s, 8, 'Scrambled eggs with onions', 7000, 'per_unit', 'pan');
  perform pg_temp.item(s, 9, 'Scrambled omelette eggs', 7500, 'per_unit', 'pan');
  perform pg_temp.item(s, 10, 'Penne', 6000, 'per_unit', 'pan');
  perform pg_temp.item(s, 11, 'Broccoli with melted cheese', 7500, 'per_unit', 'pan');
  perform pg_temp.item(s, 12, 'Grilled vegetables with melted cheese', 7500, 'per_unit', 'pan');

  s := pg_temp.sec(m, 'Soup bar', 4, 0, null, 'Optional · includes soup sterno and fire');
  perform pg_temp.item(s, 1, 'Hearty vegetable soup', 14000, 'per_unit', 'pot');
  perform pg_temp.item(s, 2, 'Zucchini potato soup (gluten free)', 14000, 'per_unit', 'pot');
  perform pg_temp.item(s, 3, 'French onion soup with cheese and croutons', 16500, 'per_unit', 'pot');
  perform pg_temp.item(s, 4, 'Mushroom barley soup', 13500, 'per_unit', 'pot');
  perform pg_temp.item(s, 5, 'Cream of broccoli soup', 17500, 'per_unit', 'pot');
  perform pg_temp.item(s, 6, 'Soup lids and cups', 1300, 'per_unit', 'pack of 25');

  s := pg_temp.sec(m, 'Platters and desserts', 5, 0, null, 'Optional');
  perform pg_temp.item(s, 1, 'Mixed fruit bowl', 7500, 'per_unit', 'bowl');
  perform pg_temp.item(s, 2, 'Yogurt parfaits', 4800, 'per_unit', '6 pieces');
  perform pg_temp.item(s, 3, '10" cheesecake', 10000, 'per_unit', 'cake');
  perform pg_temp.item(s, 4, 'Cheesecake miniatures / petit fours', 6500, 'per_unit', 'dozen');
  perform pg_temp.item(s, 5, '12" churro platter (30 pieces, 2 dipping sauces)', 9500, 'per_unit', 'platter');
  perform pg_temp.item(s, 6, '14" churro platter (50 pieces, 2 dipping sauces)', 13000, 'per_unit', 'platter');
  perform pg_temp.item(s, 7, 'Side of salmon platter', 14500, 'per_unit', 'platter');
  perform pg_temp.item(s, 8, 'Salmon cubes platter (36 pieces)', 16000, 'per_unit', 'platter');
  perform pg_temp.item(s, 9, '14" vegetable platter', 12000, 'per_unit', 'platter');
  perform pg_temp.item(s, 10, '14" cheese board', 15000, 'per_unit', 'board');
  perform pg_temp.item(s, 11, 'Additional pastries', 4000, 'per_unit', 'dozen');
  perform pg_temp.item(s, 12, 'Additional donuts', 2400, 'per_unit', 'dozen');

  s := pg_temp.sec(m, 'More large salads and challah', 6, 0, null, 'Optional');
  perform pg_temp.item(s, 1, 'Seudah challah', 4000, 'per_unit', 'challah');
  perform pg_temp.item(s, 2, 'Elegant broccoli salad', 9500, 'per_unit', 'salad');
  perform pg_temp.item(s, 3, 'Crispy onion salad', 8500, 'per_unit', 'salad');
  perform pg_temp.item(s, 4, 'Sweet potato beet with quinoa salad (dairy)', 9500, 'per_unit', 'salad');
  perform pg_temp.item(s, 5, 'Classic portobello salad', 8500, 'per_unit', 'salad');
  perform pg_temp.item(s, 6, 'Sweet chef salad', 8500, 'per_unit', 'salad');
  perform pg_temp.item(s, 7, 'Classic pasta salad', 7000, 'per_unit', 'salad');

  s := pg_temp.sec(m, 'Drink bar', 7, 0, null, 'Optional · carafes');
  perform pg_temp.item(s, 1, 'Strawberry smoothie', 2800, 'per_unit', 'carafe');
  perform pg_temp.item(s, 2, 'Strawberry mango smoothie', 2800, 'per_unit', 'carafe');
  perform pg_temp.item(s, 3, 'Acai lychee smoothie', 3000, 'per_unit', 'carafe');
  perform pg_temp.item(s, 4, 'Exotic passion fruit smoothie', 3000, 'per_unit', 'carafe');
  perform pg_temp.item(s, 5, 'Mango smoothie', 2400, 'per_unit', 'carafe');
  perform pg_temp.item(s, 6, 'Mixed fruit smoothie (no sugar added)', 2400, 'per_unit', 'carafe');
  perform pg_temp.item(s, 7, 'Creamy strawberry (dairy)', 3000, 'per_unit', 'carafe');
  perform pg_temp.item(s, 8, 'Creamy mixed berry (dairy)', 3000, 'per_unit', 'carafe');
  perform pg_temp.item(s, 9, 'Creamy creamsicle mango (dairy)', 3000, 'per_unit', 'carafe');
  perform pg_temp.item(s, 10, 'Cappuccino mocha iced coffee (dairy)', 2200, 'per_unit', 'carafe');
  perform pg_temp.item(s, 11, 'Caramel frapp iced coffee (dairy)', 2200, 'per_unit', 'carafe');

  s := pg_temp.sec(m, 'Stations', 8, 0, null, 'Optional · priced on request');
  perform pg_temp.item(s, 1, 'Fresh coffee station', 0, 'flat');
  perform pg_temp.item(s, 2, 'Omelette and egg station', 0, 'flat');
  perform pg_temp.item(s, 3, 'Waffle bar', 0, 'flat');
  perform pg_temp.item(s, 4, 'Salad bar', 0, 'flat');
  perform pg_temp.item(s, 5, 'Acai bar', 0, 'flat');
  perform pg_temp.item(s, 6, 'Ice cream bar', 0, 'flat');

  -- Shalosh Seudos: ready-to-serve packages (prices from the online menu).
  insert into public.menus (org_id, name, styles, occasions, pricing, base_price_cents, min_guests,
                            gratuity_percent, child_price_percent, included_note, sort_order)
  values (org, 'Shalosh Seudos', '{plated,family,buffet}', '{shalosh_seudos}', 'per_person', 0, 0, 0, 100,
    'A complete selection of our best shalosh seudos items, delivered before Shabbos ready to serve.', 2)
  returning id into m;

  s := pg_temp.sec(m, 'Package', 1, 1, 1);
  perform pg_temp.item(s, 1, 'Package for 12 to 15 people', 37500, 'flat');
  perform pg_temp.item(s, 2, 'Package for 25 to 30 people', 62000, 'flat');
  perform pg_temp.item(s, 3, 'Package for 50 to 55 people', 125000, 'flat');

  s := pg_temp.sec(m, 'Extra salads', 2, 0, null, 'Optional · large bowl, serves 14 to 16');
  perform pg_temp.item(s, 1, 'Large salad', 7500, 'per_unit', 'salad', 1, salads);
  perform pg_temp.item(s, 2, 'Sushi salad platter', 9500, 'per_unit', 'platter');
  perform pg_temp.item(s, 3, 'Classic quinoa salad', 3500, 'per_unit', 'container');

  s := pg_temp.sec(m, 'Fish platters', 3, 0, null, 'Optional');
  perform pg_temp.item(s, 1, 'Gourmet side of salmon platter', 14500, 'per_unit', 'platter', 1, '{Lemon dill,Sesame teriyaki,Spiced}');
  perform pg_temp.item(s, 2, 'Cubed salmon platter', 12500, 'per_unit', 'platter');
  perform pg_temp.item(s, 3, 'Deluxe tuna platter', 6000, 'per_unit', 'platter');
  perform pg_temp.item(s, 4, 'Tuna and lox platter', 7000, 'per_unit', 'platter');
  perform pg_temp.item(s, 5, 'Crispy flounder platter with dips', 10500, 'per_unit', 'platter');

  s := pg_temp.sec(m, 'Breads and dips', 4, 0, null, 'Optional');
  perform pg_temp.item(s, 1, 'Seudah challah', 4000, 'per_unit', 'challah');
  perform pg_temp.item(s, 2, 'Authentic sourdough rolls', 3600, 'per_unit', 'dozen');
  perform pg_temp.item(s, 3, 'Mini baguettes and pretzel rolls platter (35 pieces)', 5500, 'per_unit', 'platter');
  perform pg_temp.item(s, 4, 'Dips', 1499, 'per_unit', 'pound', 1, '{Matbucha,Garlic,Olive,Babaganoush,Chummus}');

  s := pg_temp.sec(m, 'Desserts', 5, 0, null, 'Optional');
  perform pg_temp.item(s, 1, '10x10 fruit platter', 6500, 'per_unit', 'platter');
  perform pg_temp.item(s, 2, 'Cookie and pastry platter', 6500, 'per_unit', 'platter');
  perform pg_temp.item(s, 3, 'Fresh churro platter with dipping sauce', 9500, 'per_unit', 'platter');

  -- Simcha buffet for bat mitzvahs, upsherins, melava malkas and other
  -- parties. Per-person price with "choose N, each extra choice +$X pp".
  -- SAMPLE prices: to confirm with Green Bowl.
  insert into public.menus (org_id, name, styles, occasions, pricing, base_price_cents, min_guests, child_price_cents, min_children,
                            gratuity_percent, child_price_percent, included_note, sort_order)
  values (org, 'Simcha buffet', '{plated,family,buffet}', null, 'per_person', 3200, 40, 1600, 0, 0, 100,
    'Cloth tablecloths, paper goods, assorted rolls, soda and water.', 3)
  returning id into m;

  s := pg_temp.sec(m, 'Salads', 1, 2, null, null, 2, 200);
  perform pg_temp.item(s, 1, 'GB Caesar');
  perform pg_temp.item(s, 2, 'Classic portobello');
  perform pg_temp.item(s, 3, 'Sesame crunch (nish nosh)');
  perform pg_temp.item(s, 4, 'Seasonal fruity lettuce');
  perform pg_temp.item(s, 5, 'Sweet potato beet with quinoa', 100);
  perform pg_temp.item(s, 6, 'Artisan green pistachio romaine', 200);
  perform pg_temp.item(s, 7, 'Dairy Greek salad');

  s := pg_temp.sec(m, 'Hot entrées', 2, 2, null, null, 2, 500);
  perform pg_temp.item(s, 1, 'Fettuccine Alfredo');
  perform pg_temp.item(s, 2, 'Baked ziti');
  perform pg_temp.item(s, 3, 'Mac and cheese');
  perform pg_temp.item(s, 4, 'Stuffed shells');
  perform pg_temp.item(s, 5, 'Lasagna');
  perform pg_temp.item(s, 6, 'Eggplant parmesan', 200);
  perform pg_temp.item(s, 7, 'Lemon dill salmon', 600);
  perform pg_temp.item(s, 8, 'Sesame teriyaki salmon', 600);

  s := pg_temp.sec(m, 'Sides', 3, 2, null, null, 2, 200);
  perform pg_temp.item(s, 1, 'Crispy fries');
  perform pg_temp.item(s, 2, 'Sweet potato fries');
  perform pg_temp.item(s, 3, 'Onion rings');
  perform pg_temp.item(s, 4, 'Potato bourekas');
  perform pg_temp.item(s, 5, 'Mini egg rolls');
  perform pg_temp.item(s, 6, 'String beans almondine');
  perform pg_temp.item(s, 7, 'Roasted mini spicy potatoes');
  perform pg_temp.item(s, 8, 'Wild rice pilaf with nuts and craisins');

  s := pg_temp.sec(m, 'Dessert', 4, 1, null, null, 1, 200);
  perform pg_temp.item(s, 1, 'Assorted pastry platters');
  perform pg_temp.item(s, 2, 'Churros with chocolate dip');
  perform pg_temp.item(s, 3, 'Donut platters');
  perform pg_temp.item(s, 4, 'Fresh fruit platters');
  perform pg_temp.item(s, 5, 'Mini cheesecake bars (dairy)', 200);

  s := pg_temp.sec(m, 'Extras', 5, 0, null, 'Optional');
  perform pg_temp.item(s, 1, 'Hard white plates and cutlery', 300);
  perform pg_temp.item(s, 2, 'Sushi salad platter', 9500, 'per_unit', 'platter');
  perform pg_temp.item(s, 3, 'Gourmet cheese board', 13000, 'per_unit', 'board');
  perform pg_temp.item(s, 4, 'Smoothie carafe', 2400, 'per_unit', 'carafe', 1, '{Strawberry,Mango,Strawberry mango,Mixed fruit}');
  perform pg_temp.item(s, 5, 'Soup', 7000, 'per_unit', '5 quart pot', 1, '{Hearty vegetable,Zucchini potato,Mushroom barley}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Sample bookings for demos, in the weeks after this file is first applied.
-- ---------------------------------------------------------------------------

-- The first date on or after p_from that falls on weekday p_dow (0 = Sunday)
-- and isn't a closed day.
create function pg_temp.next_day(p_from date, p_dow int) returns date language sql as $$
  select d::date from generate_series(p_from, p_from + 120, interval '1 day') d
  where extract(dow from d) = p_dow
    and not exists (select 1 from public.closed_days c
                    where c.org_id = '00000000-0000-4000-8000-000000006b01' and c.day = d::date)
  order by d limit 1;
$$;

create function pg_temp.pick(p_booking uuid, p_menu text, p_item text, p_qty int default 1, p_choices text[] default '{}')
returns void language sql as $$
  insert into public.booking_menu_items (org_id, booking_id, item_id, quantity, choices, price_cents, price_unit, extra_unit_price_cents)
  select '00000000-0000-4000-8000-000000006b01', p_booking, i.id,
         case when i.price_unit = 'per_unit' then p_qty else 0 end, p_choices,
         i.price_cents, i.price_unit, i.extra_unit_price_cents
  from public.menu_items i
  join public.menu_sections s on s.id = i.section_id
  join public.menus m on m.id = s.menu_id
  where m.org_id = '00000000-0000-4000-8000-000000006b01' and m.name = p_menu and i.name = p_item;
$$;

do $$
declare
  org constant uuid := '00000000-0000-4000-8000-000000006b01';
  venue uuid;
  morning uuid;
  afternoon uuid;
  evening uuid;
  b uuid;
begin
  select id into venue from public.venues where org_id = org and kind = 'catering' order by sort_order limit 1;
  select id into morning from public.slots where org_id = org and key = 'morning';
  select id into afternoon from public.slots where org_id = org and key = 'afternoon';
  select id into evening from public.slots where org_id = org and key = 'evening';

  -- A bris: booked, deposit in, contract signed.
  insert into public.bookings (org_id, venue_id, slot_id, event_date, start_minute, duration_minutes, status,
    client_first_name, client_last_name, client_phone, client_email, venue_address, party_style, occasion,
    guests_men, guests_women, guests_children, waiters, mechitza,
    deposit_paid, deposit_method, deposit_amount_cents, deposit_received_on, contract_sent_on, contract_signed_on, notes)
  values (org, venue, morning, pg_temp.next_day(current_date + 8, 0), 480, 180, 'booked',
    'Moshe', 'Klein', '732-555-0142', 'mklein@example.com', 'Congregation Bais Yaakov, 120 Forest Ave, Lakewood, NJ', 'buffet', 'bris',
    48, 42, 18, 3, true,
    true, 'zelle', 50000, current_date - 2, current_date - 2, current_date - 1, 'Shul hall downstairs. Kiddush cups from the shul.')
  returning id into b;
  perform pg_temp.pick(b, 'Bris package', 'GB Caesar');
  perform pg_temp.pick(b, 'Bris package', 'Greek salad');
  perform pg_temp.pick(b, 'Bris package', 'Fruity salad');
  perform pg_temp.pick(b, 'Bris package', 'Hard white plates and cutlery');
  perform pg_temp.pick(b, 'Bris package', 'Egg salad');
  perform pg_temp.pick(b, 'Bris package', 'Pancakes and syrup', 2);
  perform pg_temp.pick(b, 'Bris package', 'Scrambled eggs', 2);
  perform pg_temp.pick(b, 'Bris package', 'Strawberry mango smoothie', 3);

  -- A melava malka on Motzei Shabbos: on hold, waiting for the deposit.
  insert into public.bookings (org_id, venue_id, slot_id, event_date, start_minute, duration_minutes, status, hold_expires_at,
    client_first_name, client_last_name, client_phone, venue_address, party_style, occasion,
    guests_men, guests_women, guests_children, waiters, mechitza)
  values (org, venue, evening, pg_temp.next_day(current_date + 10, 6), 1230, 180, 'hold', now() + interval '3 days',
    'Chaim', 'Friedman', '732-555-0187', '45 Vine Ave, Lakewood, NJ', 'buffet', 'melava_malka',
    35, 30, 0, 2, true)
  returning id into b;
  perform pg_temp.pick(b, 'Simcha buffet', 'GB Caesar');
  perform pg_temp.pick(b, 'Simcha buffet', 'Classic portobello');
  perform pg_temp.pick(b, 'Simcha buffet', 'Fettuccine Alfredo');
  perform pg_temp.pick(b, 'Simcha buffet', 'Baked ziti');
  perform pg_temp.pick(b, 'Simcha buffet', 'Lemon dill salmon');
  perform pg_temp.pick(b, 'Simcha buffet', 'Crispy fries');
  perform pg_temp.pick(b, 'Simcha buffet', 'Potato bourekas');
  perform pg_temp.pick(b, 'Simcha buffet', 'Churros with chocolate dip');

  -- Shalosh seudos, dropped off before Shabbos (no waiters).
  insert into public.bookings (org_id, venue_id, slot_id, event_date, start_minute, duration_minutes, status,
    client_first_name, client_last_name, client_phone, venue_address, party_style, occasion,
    guests_men, guests_women, guests_children, waiters,
    deposit_paid, deposit_method, deposit_amount_cents, deposit_received_on, contract_sent_on, notes)
  values (org, venue, afternoon, pg_temp.next_day(current_date + 4, 6), 930, 120, 'booked',
    'Yehuda', 'Weiss', '732-555-0119', 'Khal Zichron Yaakov, 300 Park Ave, Lakewood, NJ', 'buffet', 'shalosh_seudos',
    28, 0, 0, 0,
    true, 'credit_card', 20000, current_date - 5, current_date - 5, 'Deliver Friday by 1 PM. Set up in the shul kitchen.')
  returning id into b;
  perform pg_temp.pick(b, 'Shalosh Seudos', 'Package for 25 to 30 people');
  perform pg_temp.pick(b, 'Shalosh Seudos', 'Large salad', 1, '{Sweet chef}');
  perform pg_temp.pick(b, 'Shalosh Seudos', 'Seudah challah', 2);

  -- A bat mitzvah: booked, contract sent but not signed yet.
  insert into public.bookings (org_id, venue_id, slot_id, event_date, start_minute, duration_minutes, status,
    client_first_name, client_last_name, client_phone, client_email, venue_address, party_style, occasion,
    guests_men, guests_women, guests_children, waiters, head_table,
    deposit_paid, deposit_method, deposit_amount_cents, deposit_received_on, contract_sent_on)
  values (org, venue, afternoon, pg_temp.next_day(current_date + 20, 0), 750, 240, 'booked',
    'Rivka', 'Gross', '732-555-0164', 'rgross@example.com', '1650 Lanes Mill Rd, Lakewood, NJ', 'buffet', 'bat_mitzvah',
    10, 55, 25, 4, true,
    true, 'check', 50000, current_date - 1, current_date - 1)
  returning id into b;
  perform pg_temp.pick(b, 'Simcha buffet', 'Seasonal fruity lettuce');
  perform pg_temp.pick(b, 'Simcha buffet', 'Artisan green pistachio romaine');
  perform pg_temp.pick(b, 'Simcha buffet', 'Dairy Greek salad');
  perform pg_temp.pick(b, 'Simcha buffet', 'Stuffed shells');
  perform pg_temp.pick(b, 'Simcha buffet', 'Mac and cheese');
  perform pg_temp.pick(b, 'Simcha buffet', 'Sweet potato fries');
  perform pg_temp.pick(b, 'Simcha buffet', 'Onion rings');
  perform pg_temp.pick(b, 'Simcha buffet', 'Mini cheesecake bars (dairy)');
  perform pg_temp.pick(b, 'Simcha buffet', 'Smoothie carafe', 4, '{Strawberry mango}');

  -- An upsherin: on hold.
  insert into public.bookings (org_id, venue_id, slot_id, event_date, start_minute, duration_minutes, status, hold_expires_at,
    client_first_name, client_last_name, client_phone, venue_address, party_style, occasion,
    guests_men, guests_women, guests_children, waiters)
  values (org, venue, afternoon, pg_temp.next_day(current_date + 13, 2), 900, 180, 'hold', now() + interval '2 days',
    'Shmuel', 'Rosen', '732-555-0133', '22 Cedarview Ave, Lakewood, NJ', 'buffet', 'upsherin',
    20, 20, 30, 2);
end;
$$;
