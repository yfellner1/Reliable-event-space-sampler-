import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const DB_URL = process.env.SUPABASE_DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const DOMAIN = process.env.AUTH_EMAIL_DOMAIN || "users.partybooking.invalid";

export type DB = SupabaseClient<Database>;
export type Role = Database["public"]["Enums"]["member_role"];

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const service: DB = createClient<Database>(URL, SECRET, opts);
export const anon = (): DB => createClient<Database>(URL, PUBLISHABLE, opts);

export const RUN = randomUUID().slice(0, 8);
export const KALAMATA_ORG = "00000000-0000-4000-8000-00000000ca1a";

/** Creates a login + profile with the service key and returns a signed-in client. */
export async function makeUser(role: Role, orgId = KALAMATA_ORG, label: string = role) {
  const username = `t-${RUN}-${label}`.toLowerCase();
  const password = `pw-${RUN}-${label}`;
  // Right after `supabase db reset` the auth service may still be restarting.
  let data, error;
  for (let attempt = 0; attempt < 15; attempt++) {
    ({ data, error } = await service.auth.admin.createUser({
      email: `${username}@${DOMAIN}`,
      password,
      email_confirm: true,
    }));
    if (!error || (error.status && error.status < 500 && error.status !== 0)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (error || !data?.user) throw error ?? new Error("Could not create user");
  const { error: pe } = await service
    .from("profiles")
    .insert({ id: data.user.id, org_id: orgId, username, display_name: `Test ${label}`, role });
  if (pe) throw pe;
  const client = anon();
  const { error: se } = await client.auth.signInWithPassword({
    email: `${username}@${DOMAIN}`,
    password,
  });
  if (se) throw se;
  return { id: data.user.id, username, client };
}

export async function ids(orgId = KALAMATA_ORG) {
  const { data: venues } = await service.from("venues").select("id, name, kind").eq("org_id", orgId);
  const { data: slots } = await service.from("slots").select("id, key").eq("org_id", orgId);
  const venue = (name: string) => venues!.find((v) => v.name === name)!.id;
  const slot = (key: string) => slots!.find((s) => s.key === key)!.id;
  return { venue, slot };
}

let dayCounter = 0;
const base = Date.UTC(2100 + (parseInt(RUN, 16) % 700), 0, 1);
/** A Sunday-to-Thursday date no other test (or earlier run) uses. */
export function freshDate(): string {
  for (;;) {
    dayCounter += 1;
    const d = new Date(base + dayCounter * 86_400_000);
    if (d.getUTCDay() <= 4) return d.toISOString().slice(0, 10);
  }
}

/** The next unused date that falls on the given weekday (0 = Sunday). */
export function freshWeekday(dow: number, month?: number): string {
  for (;;) {
    dayCounter += 1;
    const d = new Date(base + dayCounter * 86_400_000);
    if (d.getUTCDay() === dow && (month === undefined || d.getUTCMonth() === month)) {
      return d.toISOString().slice(0, 10);
    }
  }
}

export function booking(
  venueId: string,
  slotId: string,
  date: string,
  extra: Partial<Database["public"]["Tables"]["bookings"]["Insert"]> = {},
): Database["public"]["Tables"]["bookings"]["Insert"] {
  return {
    org_id: KALAMATA_ORG,
    venue_id: venueId,
    slot_id: slotId,
    event_date: date,
    start_minute: 780,
    duration_minutes: 180,
    status: "hold",
    hold_expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    client_first_name: "Test",
    client_last_name: "Client",
    client_phone: "732-555-0100",
    ...extra,
  };
}
