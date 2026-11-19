/**
 * Database security and booking rules, run against the local Supabase stack
 * (npm run db:start). Each test signs in as a real user of the given role.
 */
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DB_URL,
  KALAMATA_ORG,
  anon,
  booking,
  freshDate,
  ids,
  makeUser,
  service,
  type DB,
} from "./helpers";

let admin: DB, editor: DB, kitchen: DB;
let adminId: string, editorId: string, kitchenId: string;
let K: string, N: string, OTHER: string, AFTERNOON: string, MORNING: string, EVENING: string;

beforeAll(async () => {
  const a = await makeUser("admin");
  const e = await makeUser("editor");
  const k = await makeUser("kitchen");
  [admin, editor, kitchen] = [a.client, e.client, k.client];
  [adminId, editorId, kitchenId] = [a.id, e.id, k.id];
  const { venue, slot } = await ids();
  K = venue("Kalamata event space");
  N = venue("Novel");
  OTHER = venue("Other");
  AFTERNOON = slot("afternoon");
  MORNING = slot("morning");
  EVENING = slot("evening");
});

describe("signed-out visitors", () => {
  it("cannot read anything", async () => {
    const c = anon();
    for (const table of ["organizations", "profiles", "venues", "slots", "bookings", "audit_log"] as const) {
      const { data } = await c.from(table).select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
    const { data } = await c.from("kitchen_schedule").select("*").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("cannot create a booking", async () => {
    const { error } = await anon().from("bookings").insert(booking(K, AFTERNOON, freshDate()));
    expect(error).not.toBeNull();
  });
});

describe("double bookings", () => {
  it("blocks a second booking for the same venue, date, and slot", async () => {
    const date = freshDate();
    const first = await editor.from("bookings").insert(booking(K, AFTERNOON, date));
    expect(first.error).toBeNull();
    const second = await editor.from("bookings").insert(booking(K, AFTERNOON, date));
    expect(second.error?.code).toBe("23505");
  });

  it("lets two people saving at the same moment produce exactly one booking", async () => {
    const date = freshDate();
    const results = await Promise.all(
      [editor, admin, editor, admin, editor, admin].map((c) =>
        c.from("bookings").insert(booking(K, EVENING, date, { start_minute: 1080 })),
      ),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(1);
    expect(results.filter((r) => r.error?.code === "23505")).toHaveLength(5);
  });

  it("allows the same slot at a different venue", async () => {
    const date = freshDate();
    expect((await editor.from("bookings").insert(booking(K, EVENING, date, { start_minute: 1080 }))).error).toBeNull();
    expect((await editor.from("bookings").insert(booking(N, EVENING, date, { start_minute: 1080 }))).error).toBeNull();
  });

  it("allows several 'Other' location bookings in one slot", async () => {
    const date = freshDate();
    const other = (name: string) => booking(OTHER, AFTERNOON, date, { other_venue_name: name });
    expect((await editor.from("bookings").insert(other("Hall A"))).error).toBeNull();
    expect((await editor.from("bookings").insert(other("Hall B"))).error).toBeNull();
  });

  it("requires a name for an 'Other' location", async () => {
    const { error } = await editor.from("bookings").insert(booking(OTHER, AFTERNOON, freshDate()));
    expect(error?.message).toMatch(/other location/i);
  });

  it("keeps the slot for an unpaid hold, even long after its follow-up time", async () => {
    const date = freshDate();
    const { data: stale } = await service
      .from("bookings")
      .insert(booking(K, AFTERNOON, date, { hold_expires_at: new Date(Date.now() - 60_000).toISOString() }))
      .select("id")
      .single();
    const second = await editor.from("bookings").insert(booking(K, AFTERNOON, date));
    expect(second.error?.code).toBe("23505");
    const { data: old } = await service.from("bookings").select("status").eq("id", stale!.id).single();
    expect(old!.status).toBe("hold");
  });

  it("frees the slot when a booking is cancelled, and keeps the record", async () => {
    const date = freshDate();
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, date)).select("id").single();
    expect((await editor.from("bookings").update({ status: "cancelled" }).eq("id", b!.id)).error).toBeNull();
    expect((await editor.from("bookings").insert(booking(K, AFTERNOON, date))).error).toBeNull();
    const { data: kept } = await editor.from("bookings").select("status, cancelled_at").eq("id", b!.id).single();
    expect(kept!.status).toBe("cancelled");
    expect(kept!.cancelled_at).not.toBeNull();
  });
});

describe("booking rules", () => {
  it("turns a hold into a booking when the deposit is recorded", async () => {
    const { data, error } = await editor
      .from("bookings")
      .insert(
        booking(K, AFTERNOON, freshDate(), {
          deposit_paid: true,
          deposit_method: "zelle",
          deposit_amount_cents: 40000,
          deposit_received_on: "2026-11-16",
        }),
      )
      .select("status, hold_expires_at")
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe("booked");
    expect(data!.hold_expires_at).toBeNull();
  });

  it("allows deposit, contract signed, and party finalized all in one save", async () => {
    const { data, error } = await editor
      .from("bookings")
      .insert(
        booking(K, AFTERNOON, freshDate(), {
          deposit_paid: true,
          deposit_method: "check",
          deposit_amount_cents: 40000,
          deposit_received_on: "2026-11-16",
          contract_signed_on: "2026-11-16",
          final_confirmed: true,
          guests_men: 20,
          guests_women: 20,
          guests_children: 5,
        }),
      )
      .select("status, guests_total, final_confirmed")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ status: "booked", guests_total: 45, final_confirmed: true });
  });

  it("refuses a paid deposit with no payment method", async () => {
    const { error } = await editor
      .from("bookings")
      .insert(booking(K, AFTERNOON, freshDate(), { deposit_paid: true, deposit_amount_cents: 40000 }));
    expect(error?.code).toBe("23514");
  });

  it("refuses party finalized with no guest count", async () => {
    const { error } = await editor
      .from("bookings")
      .insert(booking(K, AFTERNOON, freshDate(), { final_confirmed: true }));
    expect(error?.code).toBe("23514");
  });

  it.each([
    ["missing last name", { client_last_name: "" }],
    ["missing phone", { client_phone: "" }],
  ])("refuses a booking with %s", async (_label, extra) => {
    const { error } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate(), extra));
    expect(error?.code).toBe("23514");
  });

  it("refuses a morning party that starts after 7:00 AM", async () => {
    const { error } = await editor
      .from("bookings")
      .insert(booking(K, MORNING, freshDate(), { party_style: "bris", start_minute: 435, duration_minutes: 120 }));
    expect(error?.hint).toBe("slot_start");
  });

  it("refuses a morning party that runs past 10:00 AM", async () => {
    const { error } = await editor
      .from("bookings")
      .insert(booking(K, MORNING, freshDate(), { party_style: "bris", start_minute: 420, duration_minutes: 210 }));
    expect(error?.hint).toMatch(/slot_(end|length)/);
  });

  it("allows an evening party that ends exactly at 10:30 PM", async () => {
    const { error } = await editor
      .from("bookings")
      .insert(booking(K, EVENING, freshDate(), { start_minute: 1170, duration_minutes: 180 }));
    expect(error).toBeNull();
  });

  it("refuses an evening party that starts after 7:30 PM", async () => {
    const { error } = await editor
      .from("bookings")
      .insert(booking(K, EVENING, freshDate(), { start_minute: 1185, duration_minutes: 120 }));
    expect(error?.hint).toBe("slot_start");
  });

  it("refuses a party longer than 3 hours", async () => {
    const { error } = await editor
      .from("bookings")
      .insert(booking(K, AFTERNOON, freshDate(), { duration_minutes: 210 }));
    expect(error?.hint).toBe("slot_length");
  });

  it("records who created and last edited a booking", async () => {
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate())).select("id").single();
    await admin.from("bookings").update({ notes: "Edited by admin" }).eq("id", b!.id);
    const { data } = await admin.from("bookings").select("created_by, updated_by").eq("id", b!.id).single();
    expect(data).toEqual({ created_by: editorId, updated_by: adminId });
  });

  it("ignores attempts to forge the creator", async () => {
    const { data } = await editor
      .from("bookings")
      .insert(booking(K, AFTERNOON, freshDate(), { created_by: adminId }))
      .select("created_by")
      .single();
    expect(data!.created_by).toBe(editorId);
  });
});

describe("kitchen staff", () => {
  it("cannot read the bookings table", async () => {
    await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate()));
    const { data } = await kitchen.from("bookings").select("*");
    expect(data).toEqual([]);
  });

  it("cannot create, change, or delete bookings", async () => {
    const date = freshDate();
    const insert = await kitchen.from("bookings").insert(booking(K, AFTERNOON, date));
    expect(insert.error?.code).toBe("42501");

    const { data: b } = await editor.from("bookings").insert(booking(N, EVENING, date, { start_minute: 1080 })).select("id").single();
    await kitchen.from("bookings").update({ notes: "kitchen edit" }).eq("id", b!.id);
    await kitchen.from("bookings").delete().eq("id", b!.id);
    const { data: after } = await editor.from("bookings").select("notes").eq("id", b!.id).single();
    expect(after).toEqual({ notes: null });
  });

  it("sees booked parties with guest counts, but no prices, deposits, or contact details", async () => {
    const date = freshDate();
    const { data: b } = await editor
      .from("bookings")
      .insert(
        booking(K, AFTERNOON, date, {
          deposit_paid: true,
          deposit_method: "cash",
          deposit_amount_cents: 40000,
          deposit_received_on: "2026-11-16",
          guests_men: 10,
          guests_women: 12,
          guests_children: 3,
        }),
      )
      .select("id")
      .single();
    // A hold on the same day at another venue should not show.
    await editor.from("bookings").insert(booking(N, EVENING, date, { start_minute: 1080 }));

    const { data, error } = await kitchen.from("kitchen_schedule").select("*").eq("event_date", date);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const row = data![0] as Record<string, unknown>;
    expect(row.id).toBe(b!.id);
    expect(row.guests_total).toBe(25);
    for (const hidden of [
      "client_first_name",
      "client_last_name",
      "client_phone",
      "client_email",
      "deposit_paid",
      "deposit_method",
      "deposit_amount_cents",
      "venue_fee_cents",
      "contract_file_path",
      "notes",
    ]) {
      expect(row).not.toHaveProperty(hidden);
    }
  });

  it("cannot see the audit log", async () => {
    const { data } = await kitchen.from("audit_log").select("*").limit(5);
    expect(data).toEqual([]);
  });

  it("can leave a note on a party, which editors can read", async () => {
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate())).select("id").single();
    const { error } = await kitchen.from("booking_notes").insert({ booking_id: b!.id, org_id: KALAMATA_ORG, body: "Need the final count by Thursday" });
    expect(error).toBeNull();
    const { data: notes } = await editor.from("booking_notes").select("body, author_id").eq("booking_id", b!.id);
    expect(notes).toEqual([{ body: "Need the final count by Thursday", author_id: kitchenId }]);
  });

  it("cannot pretend a note came from someone else", async () => {
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate())).select("id").single();
    await kitchen.from("booking_notes").insert({ booking_id: b!.id, org_id: KALAMATA_ORG, author_id: editorId, body: "forged" });
    const { data } = await editor.from("booking_notes").select("author_id").eq("booking_id", b!.id);
    expect(data!.every((n) => n.author_id === kitchenId)).toBe(true);
  });

  it("cannot change venues or slots", async () => {
    await kitchen.from("venues").update({ extra_fee_cents: 1 }).eq("id", N);
    const { data } = await service.from("venues").select("extra_fee_cents").eq("id", N).single();
    expect(data!.extra_fee_cents).toBe(50000);
  });

  it("cannot make themselves an admin", async () => {
    const direct = await kitchen.from("profiles").update({ role: "admin" }).eq("id", kitchenId);
    expect(direct.error).not.toBeNull();
    const rpc = await kitchen.rpc("admin_update_member", {
      p_user_id: kitchenId,
      p_display_name: "x",
      p_role: "admin",
      p_active: true,
    });
    expect(rpc.error?.code).toBe("42501");
    const { data } = await service.from("profiles").select("role").eq("id", kitchenId).single();
    expect(data!.role).toBe("kitchen");
  });
});

describe("editors", () => {
  it("can read bookings but cannot delete them (cancel instead)", async () => {
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate())).select("id").single();
    await editor.from("bookings").delete().eq("id", b!.id);
    const { data } = await service.from("bookings").select("id").eq("id", b!.id);
    expect(data).toHaveLength(1);
  });

  it("cannot change venue fees", async () => {
    await editor.from("venues").update({ extra_fee_cents: 1 }).eq("id", N);
    const { data } = await service.from("venues").select("extra_fee_cents").eq("id", N).single();
    expect(data!.extra_fee_cents).toBe(50000);
  });

  it("can read the audit trail for a booking", async () => {
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate())).select("id").single();
    await editor.from("bookings").update({ guests_men: 30 }).eq("id", b!.id);
    const { data } = await editor
      .from("audit_log")
      .select("action, actor_id")
      .eq("table_name", "bookings")
      .eq("row_id", b!.id)
      .order("id");
    expect(data).toEqual([
      { action: "insert", actor_id: editorId },
      { action: "update", actor_id: editorId },
    ]);
  });
});

describe("admins", () => {
  it("can change venue settings", async () => {
    const { error } = await admin.from("venues").update({ extra_fee_cents: 50000 }).eq("id", N).select().single();
    expect(error).toBeNull();
  });

  it("cannot switch off their own admin access", async () => {
    const { error } = await admin.rpc("admin_update_member", {
      p_user_id: adminId,
      p_display_name: "Test admin",
      p_role: "kitchen",
      p_active: true,
    });
    expect(error?.hint).toBe("self_demote");
  });

  it("can change another user's role", async () => {
    const extra = await makeUser("kitchen", KALAMATA_ORG, "promote");
    const { data, error } = await admin.rpc("admin_update_member", {
      p_user_id: extra.id,
      p_display_name: "Promoted",
      p_role: "editor",
      p_active: true,
    });
    expect(error).toBeNull();
    expect(data!.role).toBe("editor");
  });
});

describe("switched-off accounts", () => {
  it("lose access to data immediately, even with a valid session", async () => {
    const temp = await makeUser("editor", KALAMATA_ORG, "leaver");
    expect((await temp.client.from("venues").select("id")).data!.length).toBeGreaterThan(0);
    await admin.rpc("admin_update_member", {
      p_user_id: temp.id,
      p_display_name: "Leaver",
      p_role: "editor",
      p_active: false,
    });
    expect((await temp.client.from("venues").select("id")).data).toEqual([]);
    expect((await temp.client.from("bookings").insert(booking(K, AFTERNOON, freshDate()))).error).not.toBeNull();
  });
});

describe("separate businesses", () => {
  it("cannot see or touch each other's data", async () => {
    const { data: org } = await service
      .from("organizations")
      .insert({ slug: `other-${Date.now()}`, name: "Other Business" })
      .select("id")
      .single();
    const outsider = await makeUser("admin", org!.id, "outsider");

    expect((await outsider.client.from("venues").select("id")).data).toEqual([]);
    expect((await outsider.client.from("bookings").select("id")).data).toEqual([]);
    expect((await outsider.client.from("profiles").select("id")).data!.map((p) => p.id)).toEqual([outsider.id]);

    // Using another business's venue is refused.
    const { error } = await outsider.client.from("bookings").insert(booking(K, AFTERNOON, freshDate()));
    expect(error).not.toBeNull();

    // And their admin cannot change our users.
    const rpc = await outsider.client.rpc("admin_update_member", {
      p_user_id: editorId,
      p_display_name: "Hijacked",
      p_role: "kitchen",
      p_active: false,
    });
    expect(rpc.error).not.toBeNull();
  });
});

describe("holds never expire", () => {
  it("leaves unpaid holds alone", async () => {
    const { data: b } = await service
      .from("bookings")
      .insert(booking(N, EVENING, freshDate(), { start_minute: 1080, hold_expires_at: new Date(Date.now() - 1000).toISOString() }))
      .select("id")
      .single();
    // The same call pg_cron makes every minute. The app schema is not exposed
    // over the API, so call it directly on the local database.
    execFileSync("psql", [DB_URL, "-qAtc", "select app.expire_holds()"]);
    const { data } = await service.from("bookings").select("status").eq("id", b!.id).single();
    expect(data!.status).toBe("hold");
  });

  it("has no expiry job any more", () => {
    const out = execFileSync("psql", [DB_URL, "-qAtc", "select count(*) from cron.job where jobname = 'expire-holds'"]);
    expect(out.toString().trim()).toBe("0");
  });
});

describe("signed contracts in storage", () => {
  it("are private to editors and admins of the business", async () => {
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate())).select("id").single();
    const path = `${KALAMATA_ORG}/${b!.id}/signed-test.pdf`;
    const up = await editor.storage.from("contracts").upload(path, new Blob(["%PDF-1.4 test"], { type: "application/pdf" }));
    expect(up.error).toBeNull();

    // Kitchen staff can neither read nor upload.
    expect((await kitchen.storage.from("contracts").download(path)).error).not.toBeNull();
    expect((await kitchen.storage.from("contracts").createSignedUrl(path, 60)).error).not.toBeNull();
    const kUp = await kitchen.storage
      .from("contracts")
      .upload(`${KALAMATA_ORG}/${b!.id}/kitchen.pdf`, new Blob(["x"], { type: "application/pdf" }));
    expect(kUp.error).not.toBeNull();

    // Signed-out visitors can't read it either.
    expect((await anon().storage.from("contracts").download(path)).error).not.toBeNull();

    // Admins can.
    expect((await admin.storage.from("contracts").download(path)).error).toBeNull();
  });
});
