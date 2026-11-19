/**
 * Apply supabase/migrations/*.sql to a hosted Supabase project over the
 * Supabase Management API (HTTPS), for environments where a direct Postgres
 * connection is not available. Records each applied file in
 * supabase_migrations.schema_migrations, the same table `supabase db push`
 * uses, so the two methods can be mixed.
 *
 *   SUPABASE_ACCESS_TOKEN=... npm run db:apply -- --project <ref> [--dry-run]
 *
 * Without --dry-run it applies every file not yet recorded, in order, each in
 * its own transaction, and stops at the first error.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const ref = values.project;
if (!ref || !/^[a-z0-9]{20}$/.test(ref)) {
  console.error("--project <ref> is required (the 20-letter id in the project URL).");
  process.exit(1);
}
// The token may also be added to requests by an outbound proxy, in which case
// any placeholder value works here.
const token = process.env.SUPABASE_ACCESS_TOKEN || "injected-by-proxy";

async function query<T = unknown>(sql: string): Promise<T> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;

async function main() {
  await query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`);
  const applied = new Set(
    (await query<{ version: string }[]>("select version from supabase_migrations.schema_migrations")).map(
      (r) => r.version,
    ),
  );

  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const pending = files.filter((f) => !applied.has(f.split("_")[0]));
  if (!pending.length) {
    console.log("Database is up to date.");
    return;
  }
  for (const file of pending) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    const name = rest.join("_");
    if (values["dry-run"]) {
      console.log(`would apply ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    await query(`begin;
${sql}
;
insert into supabase_migrations.schema_migrations (version, name, statements)
values (${quote(version)}, ${quote(name)}, array[]::text[]);
commit;`);
    console.log(`applied ${file}`);
  }
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
