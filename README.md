# Event booking sample

A rebrandable booking app for party, event, and catering businesses, built by
Reliable Office Services to demo to potential clients. Staff book events on a
calendar, build the menu with live pricing, send contracts, track deposits and
payments, and share prep sheets with the kitchen.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind) on Vercel, with Supabase
(Postgres, Auth, pg_cron) as the database and login system.

## Setting it up for a business

Everything specific to one business lives in data, not code:

- `supabase/migrations/20261210000001_sample_business_green_bowl.sql` is the
  current sample business (The Green Bowl, a kosher outside caterer). It sets
  the business profile, locations, times of day, menus and prices, contract
  terms, and a few sample bookings. For another business, replace that one file.
- After launch an admin changes the same things in the app: **Settings**
  (business profile and brand color, waiters and sales tax, event types,
  locations, times of day, contract terms) and **Menus**.

What the engine supports:

- Event spaces (one party per time slot) and outside catering (any number of
  jobs, each with the event address and a delivery fee).
- Event types (Bris, Melava Malka, Shalosh Seudos, Bat Mitzvah, Upsherin, and
  more), each able to load its own menu.
- Menus priced per person or as a package, with separate adult and child
  prices and minimums, "choose N" sections where each extra choice costs a
  per-person upcharge, and items priced per person, per table, per platter or
  pan, or flat.
- Waiter staffing (price per waiter for a number of hours, optional extra-hour
  price), sales tax, gratuity, and deposits.

## How security works

- Staff sign in with a **username and password**. Supabase Auth stores each user as
  `<username>@<AUTH_EMAIL_DOMAIN>`; no email is ever sent.
- Three roles: **admin**, **editor** (secretary), **kitchen** (read-only).
- Permissions are enforced **in the database** with row-level security, not only in the
  screens. Kitchen staff cannot read the `bookings` table at all; they read the
  `kitchen_schedule` view, which has no prices, deposits, contracts, or client contact details.
- **Double bookings are impossible to save**: a unique index allows one active booking per
  venue, date, and slot. Expired holds are cleared by a pg_cron job every minute, and also
  right before a save in that slot.
- Every change to users, venues, slots, bookings, and notes is written to `audit_log`.
- Switched-off accounts are banned in Supabase Auth and lose data access immediately.

## Project layout

```
supabase/migrations/   database schema, security policies, and the sample business data
src/proxy.ts           session refresh and sign-in redirect (Next.js 16 "proxy")
src/lib/auth.ts        current member and role checks for pages and actions
src/lib/supabase/      Supabase clients (user, browser, and admin) and generated types
src/app/login          sign in
src/app/(app)          signed-in screens: home, users (admin), my account
scripts/create-user.ts create a login from the command line (first admin)
tests/unit             pure logic tests
tests/db               database security and booking-rule tests
tests/e2e              browser tests (phone-sized)
```

## Local development

Needs Node 20.9+ and Docker.

```bash
npm install
npm run db:start            # local Supabase in Docker; prints local keys
cp .env.example .env.local  # fill in the local URL and keys printed above
npm run user:create -- --username admin --name "Local Admin" --role admin --password "admin-pass-1"
npm run dev                 # http://localhost:3000
```

After changing a migration: `npm run db:reset` then `npm run db:types`.

## Tests

```bash
npm test             # unit tests
npm run test:db      # database security tests (needs npm run db:start)
npm run build && npm run test:e2e   # browser tests (needs the local database)
```

## Deploying

Hosted on Vercel with a Supabase database added through the Vercel
Marketplace, which sets the database environment variables on the project.
Each business (or demo) gets its own Vercel project and its own database.

Every **production** build runs `scripts/vercel-prebuild.ts` before `next build`
(see `vercel.json`). It applies any new files in `supabase/migrations` to the
production database. A failed migration fails the build, so the live site never
runs against a half-updated database. Preview builds share the same database and
skip this step.

**First admin:** set `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME`, and
`BOOTSTRAP_ADMIN_PASSWORD` (sensitive, production only) and deploy. The build
creates that admin only if the organization has none, then those variables
should be deleted. Everyone else is added in the app under **Users**.

Alternatives: `npx supabase db push` with a direct database connection, or
`npm run db:apply -- --project <ref>` over the Supabase Management API.

Do not change `AUTH_EMAIL_DOMAIN` after launch; existing logins would stop matching.
