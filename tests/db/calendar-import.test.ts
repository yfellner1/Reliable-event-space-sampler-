/**
 * Importing calendar parties (admin_import_booking). Needs the local stack.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { RUN, booking, freshDate, freshWeekday, ids, makeUser, service, type DB } from "./helpers";

let admin: DB, editor: DB;
let K: string, EVENING: string, AFTERNOON: string;

beforeAll(async () => {
  admin = (await makeUser("admin", undefined, "import-admin")).client;
  editor = (await makeUser("editor", undefined, "import-editor")).client;
  const { venue, slot } = await ids();
  K = venue("Kalamata event space");
  EVENING = slot("evening");
  AFTERNOON = slot("afternoon");
});

let n = 0;
const row = (extra: Record<string, unknown> = {}) => ({
  import_ref: `test:${RUN}:${++n}`,
  venue_id: K,
  slot_id: EVENING,
  event_date: freshDate(),
  start_minute: 1170,
  duration_minutes: 180,
  client_first_name: "",
  client_last_name: `Imported${n}`,
  client_phone: "732-555-0100",
  party_style: "plated",
  guests_men: 20,
  guests_women: 20,
  deposit_paid: true,
  deposit_method: "zelle",
  deposit_amount_cents: 40000,
  deposit_received_on: "2026-10-01",
  ...extra,
});

describe("admin_import_booking", () => {
  it("only admins can import", async () => {
    const { error } = await editor.rpc("admin_import_booking", { p: row() });
    expect(error?.message).toMatch(/Only admins/);
  });

  it("imports once: running it again skips the party", async () => {
    const p = row();
    expect((await admin.rpc("admin_import_booking", { p })).data).toBe("created");
    expect((await admin.rpc("admin_import_booking", { p })).data).toBe("exists");
    const { data } = await service.from("bookings").select("status, client_first_name, blocks_slot").eq("import_ref", p.import_ref);
    expect(data).toEqual([{ status: "booked", client_first_name: "", blocks_slot: true }]);
  });

  it("lets in parties that break today's rules (a Friday afternoon, a 10:30 AM brunch)", async () => {
    const friday = row({ event_date: freshWeekday(5), slot_id: AFTERNOON, start_minute: 630 });
    const { data, error } = await admin.rpc("admin_import_booking", { p: friday });
    expect(error).toBeNull();
    expect(data).toBe("created");
  });

  it("keeps both parties when the calendar had two the same evening, and both stay editable", async () => {
    const date = freshDate();
    const a = row({ event_date: date });
    const b = row({ event_date: date });
    expect((await admin.rpc("admin_import_booking", { p: a })).data).toBe("created");
    expect((await admin.rpc("admin_import_booking", { p: b })).data).toBe("created");
    const { data } = await service
      .from("bookings")
      .select("id, import_ref, blocks_slot")
      .in("import_ref", [a.import_ref, b.import_ref]);
    const first = data!.find((r) => r.import_ref === a.import_ref)!;
    const second = data!.find((r) => r.import_ref === b.import_ref)!;
    expect([first.blocks_slot, second.blocks_slot]).toEqual([true, false]);
    // Editing the second one (not its timing) still works.
    const { error } = await admin.from("bookings").update({ guests_children: 3 }).eq("id", second.id);
    expect(error).toBeNull();
  });

  it("without a deposit the party comes in as a hold", async () => {
    const p = row({ deposit_paid: false });
    expect((await admin.rpc("admin_import_booking", { p })).data).toBe("created");
    const { data } = await service.from("bookings").select("status, hold_expires_at").eq("import_ref", p.import_ref).single();
    expect(data!.status).toBe("hold");
    expect(Date.parse(data!.hold_expires_at!)).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });

  it("normal saves still follow the rules", async () => {
    const { error } = await admin.from("bookings").insert(booking(K, AFTERNOON, freshWeekday(5)));
    expect(error?.message).toMatch(/not booked on that day/);
  });
});
