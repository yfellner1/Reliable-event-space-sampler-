-- Automatic WhatsApp messages to clients: before the party (guest count and
-- menu, with their private link) and after it (thank you, and the balance).
-- Off until an admin confirms the sending number and turns them on.

alter table public.organizations
  add column client_msgs_enabled boolean not null default false,
  -- The sending number (digits) an admin confirmed. Messages only go out while
  -- it matches the number the server sends from.
  add column client_msgs_confirmed_number text,
  add column client_msg_hour integer not null default 11 check (client_msg_hour between 0 and 23),
  add column client_before_enabled boolean not null default true,
  add column client_before_days integer not null default 10 check (client_before_days between 3 and 60),
  add column client_before_text text not null default
    'Hi {first_name}! This is {business}. Your party on {date} is coming up. Please send us your final guest count and menu by {due_date} using your private link: {link}
Thank you!',
  add column client_after_enabled boolean not null default true,
  add column client_after_text text not null default
    'Hi {first_name}, thank you for celebrating with us at {business}! We hope you and your guests enjoyed it. {balance_line}';

alter table public.bookings
  add column client_before_msg_at timestamptz,
  add column client_after_msg_at timestamptz;
