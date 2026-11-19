/**
 * Menus: who can see prices, saving a booking's menu, and price snapshots.
 * Needs the local Supabase stack (npm run db:start).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { booking, freshDate, ids, makeUser, service, type DB } from "./helpers";

let admin: DB, editor: DB, kitchen: DB;
let K: string, AFTERNOON: string;
const item = async (menu: string, name: string) => {
  const { data } = await service
    .from("menu_items")
    .select("id, price_cents, menu_sections!inner(menus!inner(name))")
    .eq("name", name)
    .eq("menu_sections.menus.name", menu)
    .single();
  return data!;
};

beforeAll(async () => {
  admin = (await makeUser("admin", undefined, "menu-admin")).client;
  editor = (await makeUser("editor", undefined, "menu-editor")).client;
  kitchen = (await makeUser("kitchen", undefined, "menu-kitchen")).client;
  const { venue, slot } = await ids();
  K = venue("Kalamata event space");
  AFTERNOON = slot("afternoon");
});

const newBooking = async (extra = {}) => {
  const { data, error } = await editor
    .from("bookings")
    .insert(booking(K, AFTERNOON, freshDate(), extra))
    .select("id")
    .single();
  if (error) throw error;
  return data!.id;
};

describe("who sees menu prices", () => {
  it("editors read menus and prices", async () => {
    const { data } = await editor
      .from("menu_items")
      .select("name, price_cents, menu_sections!inner(menus!inner(name))")
      .eq("name", "Focaccia")
      .eq("menu_sections.menus.name", "Plated");
    expect(data!.map((r) => [r.name, r.price_cents])).toEqual([["Focaccia", 100]]);
  });

  it("kitchen staff cannot read menus or prices", async () => {
    for (const t of ["menus", "menu_sections", "menu_items", "booking_menu_items"] as const) {
      const { data } = await kitchen.from(t).select("*").limit(1);
      expect(data).toEqual([]);
    }
  });

  it("only admins change menu prices", async () => {
    const focaccia = await item("Plated", "Focaccia");
    await editor.from("menu_items").update({ price_cents: 1 }).eq("id", focaccia.id);
    expect((await item("Plated", "Focaccia")).price_cents).toBe(100);
    const { error } = await admin.from("menu_items").update({ price_cents: 100 }).eq("id", focaccia.id);
    expect(error).toBeNull();
  });
});

describe("saving a booking's menu", () => {
  it("saves the dishes and the notes, and the kitchen sees them once booked", async () => {
    const id = await newBooking({ party_style: "plated" });
    const focaccia = await item("Plated", "Focaccia");
    const ravioli = await item("Plated", "Ravioli");
    const { error } = await editor.rpc("set_booking_menu", {
      p_booking_id: id,
      p_items: [
        { item_id: focaccia.id, quantity: 0, choices: [] },
        { item_id: ravioli.id, quantity: 0, choices: ["Mushroom"] },
      ],
      p_notes: "One gluten-free plate",
    });
    expect(error).toBeNull();

    // Still a hold: the kitchen doesn't see it yet.
    expect((await kitchen.from("kitchen_menu").select("*").eq("booking_id", id)).data).toEqual([]);

    await editor
      .from("bookings")
      .update({ deposit_paid: true, deposit_method: "cash", deposit_amount_cents: 40000, deposit_received_on: "2026-11-16" })
      .eq("id", id);
    const { data: lines } = await kitchen
      .from("kitchen_menu")
      .select("section_name, item_name, choices")
      .eq("booking_id", id)
      .order("section_order");
    expect(lines).toEqual([
      { section_name: "Bread", item_name: "Focaccia", choices: [] },
      { section_name: "Pasta", item_name: "Ravioli", choices: ["Mushroom"] },
    ]);
    const { data: sched } = await kitchen.from("kitchen_schedule").select("menu_notes").eq("id", id).single();
    expect(sched!.menu_notes).toBe("One gluten-free plate");
    // No prices in the kitchen's view.
    const { data: raw } = await kitchen.from("kitchen_menu").select("*").eq("booking_id", id).limit(1);
    expect(Object.keys(raw![0]).some((k) => k.includes("price_cents"))).toBe(false);
  });

  it("refuses dishes from another style's menu", async () => {
    const id = await newBooking({ party_style: "plated" });
    const shakshuka = await item("Bris", "Shakshuka");
    const { error } = await editor.rpc("set_booking_menu", {
      p_booking_id: id,
      p_items: [{ item_id: shakshuka.id, quantity: 0, choices: [] }],
      p_notes: "",
    });
    expect(error?.code).toBe("23514");
  });

  it("refuses kitchen staff", async () => {
    const id = await newBooking();
    const { error } = await kitchen.rpc("set_booking_menu", { p_booking_id: id, p_items: [], p_notes: "x" });
    expect(error?.code).toBe("42501");
  });

  it("keeps the price a dish was saved with when the menu price changes later", async () => {
    const id = await newBooking({ party_style: "plated" });
    const knots = await item("Plated", "Garlic knots");
    const save = () =>
      editor.rpc("set_booking_menu", {
        p_booking_id: id,
        p_items: [{ item_id: knots.id, quantity: 0, choices: [] }],
        p_notes: "",
      });
    await save();
    await admin.from("menu_items").update({ price_cents: 250 }).eq("id", knots.id);
    try {
      await save(); // e.g. the secretary re-saves the booking for another reason
      const { data } = await editor
        .from("booking_menu_items")
        .select("price_cents")
        .eq("booking_id", id)
        .single();
      expect(data!.price_cents).toBe(100);

      // A new booking gets the new price.
      const id2 = await newBooking({ party_style: "plated" });
      await editor.rpc("set_booking_menu", {
        p_booking_id: id2,
        p_items: [{ item_id: knots.id, quantity: 0, choices: [] }],
        p_notes: "",
      });
      const { data: d2 } = await editor.from("booking_menu_items").select("price_cents").eq("booking_id", id2).single();
      expect(d2!.price_cents).toBe(250);
    } finally {
      await admin.from("menu_items").update({ price_cents: 100 }).eq("id", knots.id);
    }
  });

  it("records the menu change in the booking's history", async () => {
    const id = await newBooking();
    await editor.rpc("set_booking_menu", { p_booking_id: id, p_items: [], p_notes: "Menu to follow" });
    const { data } = await editor
      .from("audit_log")
      .select("action")
      .eq("table_name", "bookings")
      .eq("row_id", id)
      .order("id");
    expect(data!.map((r) => r.action)).toEqual(["insert", "update"]);
  });
});
