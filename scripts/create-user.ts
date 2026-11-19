/**
 * Create a login from the command line. Used once to create the first admin
 * (after that, admins add users in the app under Users).
 *
 *   npm run user:create -- --username yfellner --name "Y. Fellner" --role admin
 *
 * Options:
 *   --username   login name (required)
 *   --name       display name (required)
 *   --role       admin | editor | kitchen (default admin)
 *   --password   password; if left out, a random one is generated and printed
 *   --org        organization slug (default: the first one set up)
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and AUTH_EMAIL_DOMAIN
 * from the environment or .env.local.
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  USERNAME_RULES,
  isValidUsername,
  normalizeUsername,
  passwordProblem,
  usernameToEmail,
} from "../src/lib/usernames";

config({ path: ".env.local", quiet: true });

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "admin" },
    password: { type: "string" },
    org: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const domain = process.env.AUTH_EMAIL_DOMAIN || "users.partybooking.invalid";
  if (!url || !key) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");

  const username = normalizeUsername(values.username ?? "");
  const name = (values.name ?? "").trim();
  const role = values.role as "admin" | "editor" | "kitchen";
  if (!isValidUsername(username)) fail(`--username: ${USERNAME_RULES}`);
  if (!name) fail("--name is required.");
  if (!["admin", "editor", "kitchen"].includes(role)) fail("--role must be admin, editor, or kitchen.");

  const generated = !values.password;
  const password = values.password ?? randomBytes(9).toString("base64url");
  const problem = passwordProblem(password);
  if (problem) fail(`--password: ${problem}`);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let orgQuery = db.from("organizations").select("id, name").order("created_at").limit(1);
  if (values.org) orgQuery = orgQuery.eq("slug", values.org);
  const { data: org, error: orgError } = await orgQuery.maybeSingle();
  if (orgError || !org) fail(values.org ? `No organization with slug "${values.org}".` : "No organization set up yet.");

  const { data: created, error: authError } = await db.auth.admin.createUser({
    email: usernameToEmail(username, domain),
    password,
    email_confirm: true,
    app_metadata: { org_id: org.id },
    user_metadata: { username, display_name: name },
  });
  if (authError || !created.user) fail(`Could not create login: ${authError?.message}`);

  const { error: profileError } = await db
    .from("profiles")
    .insert({ id: created.user.id, org_id: org.id, username, display_name: name, role });
  if (profileError) {
    await db.auth.admin.deleteUser(created.user.id);
    fail(`Could not create profile: ${profileError.message}`);
  }

  console.log(`Created ${role} "${username}" (${name}) in ${org.name}.`);
  if (generated) console.log(`Password: ${password}  (change it under My account)`);
}

main().catch((e) => fail(String(e)));
