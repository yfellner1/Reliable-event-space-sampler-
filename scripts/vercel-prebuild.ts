/**
 * Runs before `next build` on Vercel.
 *
 * Production builds only (preview builds share the same database and must not
 * change it):
 *   1. Apply any new files in supabase/migrations, recorded in
 *      supabase_migrations.schema_migrations (the same table the Supabase CLI
 *      uses), each in its own transaction. A failed migration fails the build,
 *      so a broken schema never goes live.
 *   2. If BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are set and the
 *      organization has no active admin yet, create that first admin login.
 *      Remove those variables afterwards.
 *
 * Needs POSTGRES_URL_NON_POOLING, NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY, which the Supabase integration sets on the project.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { isValidUsername, normalizeUsername, passwordProblem, usernameToEmail } from "../src/lib/usernames";

// The business to create the first admin in: BOOTSTRAP_ORG_SLUG, or the first one set up.
const ORG_SLUG = process.env.BOOTSTRAP_ORG_SLUG || null;

async function migrate(dbUrl: string) {
  // Supabase's session-mode connection; prepared statements off for poolers.
  const sql = postgres(dbUrl, { ssl: dbUrl.includes("127.0.0.1") ? false : "require", max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql`create schema if not exists supabase_migrations`;
    await sql`create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text)`;
    const rows = await sql<{ version: string }[]>`select version from supabase_migrations.schema_migrations`;
    const applied = new Set(rows.map((r) => r.version));

    const dir = "supabase/migrations";
    const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    let count = 0;
    for (const file of files) {
      const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
      if (applied.has(version)) continue;
      const body = readFileSync(join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into supabase_migrations.schema_migrations (version, name, statements)
                 values (${version}, ${rest.join("_")}, ${[] as string[]})`;
      });
      console.log(`[db] applied ${file}`);
      count++;
    }
    console.log(count ? `[db] ${count} migration(s) applied` : "[db] database is up to date");
    // Tell the Supabase REST API to pick up new tables and functions.
    if (count) await sql`notify pgrst, 'reload schema'`;
  } finally {
    await sql.end();
  }
}

async function bootstrapAdmin() {
  const rawUser = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!rawUser || !password) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const domain = process.env.AUTH_EMAIL_DOMAIN || "users.partybooking.invalid";
  if (!url || !key) throw new Error("[admin] Supabase URL or secret key missing.");

  const username = normalizeUsername(rawUser);
  if (!isValidUsername(username)) throw new Error("[admin] BOOTSTRAP_ADMIN_USERNAME is not a valid username.");
  const problem = passwordProblem(password);
  if (problem) throw new Error(`[admin] BOOTSTRAP_ADMIN_PASSWORD: ${problem}`);
  const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || rawUser.trim();

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // The REST API may need a few seconds to see tables a migration just created.
  let org: { id: string } | null = null;
  for (let attempt = 0; attempt < 10 && !org; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000));
    let query = db.from("organizations").select("id").order("created_at").limit(1);
    if (ORG_SLUG) query = query.eq("slug", ORG_SLUG);
    const { data } = await query.maybeSingle();
    org = data;
  }
  if (!org) throw new Error(`[admin] organization "${ORG_SLUG ?? "(first)"}" not found`);

  const { count } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", org.id)
    .eq("role", "admin")
    .eq("active", true);
  if (count) {
    console.log("[admin] an admin already exists; nothing to do. Remove the BOOTSTRAP_ADMIN_* variables.");
    return;
  }

  const { data: created, error } = await db.auth.admin.createUser({
    email: usernameToEmail(username, domain),
    password,
    email_confirm: true,
    app_metadata: { org_id: org.id },
    user_metadata: { username, display_name: displayName },
  });
  if (error || !created.user) throw new Error(`[admin] could not create login: ${error?.message}`);
  const { error: pe } = await db
    .from("profiles")
    .insert({ id: created.user.id, org_id: org.id, username, display_name: displayName, role: "admin" });
  if (pe) {
    await db.auth.admin.deleteUser(created.user.id);
    throw new Error(`[admin] could not create profile: ${pe.message}`);
  }
  console.log(`[admin] created first admin "${username}"`);
}

/**
 * Gives the database's hourly timer the reminder address and secret, and
 * prints the reminder settings to the build log for troubleshooting.
 */
async function reminderTimer(dbUrl: string) {
  const sql = postgres(dbUrl, { ssl: dbUrl.includes("127.0.0.1") ? false : "require", max: 1, prepare: false, onnotice: () => {} });
  try {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const secret = process.env.CRON_SECRET;
    if (host && secret) {
      const url = `https://${host}/api/cron/daily-reminder`;
      await sql`insert into app.job_settings (key, value) values ('reminder_url', ${url}), ('cron_secret', ${secret})
                on conflict (key) do update set value = excluded.value`;
      console.log(`[reminder] database timer calls ${url}`);
    } else {
      console.log("[reminder] CRON_SECRET or production URL missing; database timer not set");
    }
    const orgs = await sql<{ name: string; reminder_enabled: boolean; reminder_hour: number; last_reminder_on: string | null; has_whatsapp: boolean; emails: number }[]>`
      select name, reminder_enabled, reminder_hour, last_reminder_on::text,
             reminder_whatsapp is not null and reminder_whatsapp <> '' as has_whatsapp,
             coalesce(array_length(reminder_emails, 1), 0) as emails
      from public.organizations`;
    for (const o of orgs) {
      console.log(
        `[reminder] ${o.name}: ${o.reminder_enabled ? "on" : "OFF"}, hour ${o.reminder_hour}, last sent ${o.last_reminder_on ?? "never"}, whatsapp ${o.has_whatsapp ? "set" : "not set"}, emails ${o.emails}`,
      );
    }
    const jobs = await sql<{ jobname: string; schedule: string; active: boolean }[]>`
      select jobname, schedule, active from cron.job order by jobname`.catch(() => []);
    console.log(`[reminder] database timers: ${jobs.map((j) => `${j.jobname} (${j.schedule}${j.active ? "" : ", paused"})`).join(", ") || "none"}`);
  } finally {
    await sql.end();
  }
}

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log(`[db] ${process.env.VERCEL_ENV ?? "local"} build: skipping database changes`);
    return;
  }
  const dbUrl = process.env.POSTGRES_URL_NON_POOLING;
  if (!dbUrl) throw new Error("[db] POSTGRES_URL_NON_POOLING is not set; connect the Supabase database to the project.");
  await migrate(dbUrl);
  await reminderTimer(dbUrl);
  await bootstrapAdmin();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
