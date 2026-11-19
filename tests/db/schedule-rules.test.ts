/**
 * Day-of-week, season, venue, style, and guest-limit rules, enforced by the
 * database. Needs the local Supabase stack (npm run db:start).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { booking, freshDate, freshWeekday, ids, makeUser, service, type DB } from "./helpers";

let editor: DB;
let K: string, N: string, CATERING: string, OTHER: string;
let MORNING: string, AFTERNOON: string, EVENING: string;

beforeAll(async () => {
  editor = (await makeUser("editor", undefined, "rules-editor")).client;
  const { venue, slot } = await ids();
  K = venue("Kalamata event space");
  N = venue("Novel");
  CATERING = venue("Outside catering");
  OTHER = venue("Other");
  MORNING = slot("morning");
  AFTERNOON = slot("afternoon");
  EVENING = slot("evening");
});

const evening = (date: string, extra = {}) => booking(K, EVENING, date, { start_minute: 1080, ...extra });
const bris = (date: string, extra = {}) =>
  booking(K, MORNING, date, { party_style: "bris", start_minute: 420, duration_minutes: 180, ...extra });

describe("days of the week", () => {
  it("takes only morning brises on a Friday", async () => {
    for (const b of [booking(K, AFTERNOON, freshWeekday(5)), evening(freshWeekday(5))]) {
      const { error } = await editor.from("bookings").insert(b);
      expect(error?.hint).toBe("slot_weekday");
    }
    expect((await editor.from("bookings").insert(bris(freshWeekday(5)))).error).toBeNull();
  });

  it("refuses Saturday morning and afternoon", async () => {
    expect((await editor.from("bookings").insert(bris(freshWeekday(6)))).error?.hint).toBe("slot_weekday");
    expect((await editor.from("bookings").insert(booking(K, AFTERNOON, freshWeekday(6)))).error?.hint).toBe(
      "slot_weekday",
    );
  });

  it("allows Saturday night in the winter", async () => {
    const { error } = await editor.from("bookings").insert(evening(freshWeekday(6, 0))); // January
    expect(error).toBeNull();
  });

  it("refuses Saturday night in the summer", async () => {
    const { error } = await editor.from("bookings").insert(evening(freshWeekday(6, 6))); // July
    expect(error?.hint).toBe("slot_season");
  });
});

describe("venues and styles", () => {
  it("refuses outside catering in the morning", async () => {
    const { error } = await editor
      .from("bookings")
      .insert({ ...bris(freshDate()), venue_id: CATERING, venue_address: "12 Main St" });
    expect(error?.hint).toBe("venue_slot");
  });

  it("allows outside catering in the evening", async () => {
    const { error } = await editor
      .from("bookings")
      .insert({ ...evening(freshDate()), venue_id: CATERING, venue_address: "12 Main St" });
    expect(error).toBeNull();
  });

  it("allows only brises in the morning", async () => {
    const { error } = await editor.from("bookings").insert(bris(freshDate(), { party_style: "plated" }));
    expect(error?.hint).toBe("slot_style");
    expect((await editor.from("bookings").insert(bris(freshDate()))).error).toBeNull();
  });

  it("does not allow a bris in the afternoon", async () => {
    const { error } = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate(), { party_style: "bris" }));
    expect(error?.hint).toBe("slot_style");
  });

  it("allows Other locations in any slot", async () => {
    const { error } = await editor
      .from("bookings")
      .insert({ ...bris(freshDate()), venue_id: OTHER, other_venue_name: "Shul hall" });
    expect(error).toBeNull();
  });
});

describe("Novel and afternoon times", () => {
  it("takes Novel bookings in the evening only", async () => {
    const afternoon = await editor.from("bookings").insert(booking(N, AFTERNOON, freshDate()));
    expect(afternoon.error?.hint).toBe("venue_slot");
    const morning = await editor.from("bookings").insert(bris(freshDate(), { venue_id: N }));
    expect(morning.error?.hint).toBe("venue_slot");
    const evening_ = await editor.from("bookings").insert(evening(freshDate(), { venue_id: N }));
    expect(evening_.error).toBeNull();
  });

  it("ends afternoon parties by 5:00 PM", async () => {
    const { data } = await service.from("slots").select("end_latest").eq("id", AFTERNOON).single();
    expect(data!.end_latest).toBe(1020);
    // 2:00 PM start for 3 hours ends exactly at 5:00 PM.
    const ok = await editor.from("bookings").insert(booking(K, AFTERNOON, freshDate(), { start_minute: 840 }));
    expect(ok.error).toBeNull();
  });
});

describe("guest limits", () => {
  it("caps a bris at 100 guests", async () => {
    const over = await editor
      .from("bookings")
      .insert(bris(freshDate(), { guests_men: 50, guests_women: 50, guests_children: 1 }));
    expect(over.error?.hint).toBe("slot_guests");
    const exact = await editor
      .from("bookings")
      .insert(bris(freshDate(), { guests_men: 50, guests_women: 50 }));
    expect(exact.error).toBeNull();
  });
});

describe("changing the rules later", () => {
  it("does not block edits to existing bookings that don't change the timing", async () => {
    const date = freshDate();
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, date)).select("id").single();
    // The admin later stops offering afternoons on that weekday.
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const { data: slot } = await service.from("slots").select("weekdays").eq("id", AFTERNOON).single();
    await service
      .from("slots")
      .update({ weekdays: slot!.weekdays.filter((d) => d !== dow) })
      .eq("id", AFTERNOON);
    try {
      const edit = await editor.from("bookings").update({ notes: "Bringing a cake" }).eq("id", b!.id);
      expect(edit.error).toBeNull();
      const move = await editor.from("bookings").update({ start_minute: 780 + 15 }).eq("id", b!.id);
      expect(move.error?.hint).toBe("slot_weekday");
    } finally {
      await service.from("slots").update({ weekdays: slot!.weekdays }).eq("id", AFTERNOON);
    }
  });
});

describe("restoring a cancelled booking", () => {
  it("is refused if the slot was taken in the meantime", async () => {
    const date = freshDate();
    const { data: b } = await editor.from("bookings").insert(booking(K, AFTERNOON, date)).select("id").single();
    await editor.from("bookings").update({ status: "cancelled" }).eq("id", b!.id);
    await editor.from("bookings").insert(booking(K, AFTERNOON, date));
    const restore = await editor
      .from("bookings")
      .update({ status: "hold", hold_expires_at: new Date(Date.now() + 3600_000).toISOString() })
      .eq("id", b!.id);
    expect(restore.error?.code).toBe("23505");
  });
});

describe("yom tov", () => {
  it("refuses any party on a closed day, and evening parties on Erev", async () => {
    // Pesach 2027 is April 22-29; Erev Pesach is April 21 (a Wednesday).
    const day = await editor.from("bookings").insert(booking(K, AFTERNOON, "2027-04-26"));
    expect(day.error?.hint).toBe("closed_day");
    expect(day.error?.message).toBe("Closed for Pesach.");
    const erevEvening = await editor.from("bookings").insert(evening("2027-04-21"));
    expect(erevEvening.error?.hint).toBe("closed_day");
    // Use the Other venue (shares slots) so reruns never collide.
    const erevAfternoon = await editor
      .from("bookings")
      .insert(booking(OTHER, AFTERNOON, "2027-04-21", { other_venue_name: "Hall" }))
      .select("id")
      .single();
    expect(erevAfternoon.error).toBeNull();
    await service.from("bookings").delete().eq("id", erevAfternoon.data!.id);
  });
});
