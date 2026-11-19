"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { HOLIDAY_OPTIONS } from "@/lib/holiday-pricing";
import { clientChatId, fillTemplate } from "@/lib/client-messages";
import { sendingNumber } from "@/lib/client-messages-send";
import { periskopeSend } from "@/lib/reminder-send";
import { ALL_OCCASIONS } from "@/lib/schedule";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const fail = (error: string): FormState => ({ error });
const done = (ok = "Saved."): FormState => {
  revalidatePath("/", "layout");
  return { ok, stamp: Date.now() };
};

function dollars(raw: string): number | null | "bad" {
  if (!raw) return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : "bad";
}

function whole(raw: string, min: number, max: number): number | null | "bad" {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : "bad";
}

/** "17:30" to 1050 minutes after midnight. */
function minutes(raw: string): number | null | "bad" {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "bad";
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 1440 ? v : "bad";
}

const days = (fd: FormData, k: string) =>
  fd
    .getAll(k)
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort();

export async function saveGeneral(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const name = str(fd, "name");
  const hold = whole(str(fd, "holdHours"), 1, 720);
  const deposit = dollars(str(fd, "deposit"));
  const finalDays = whole(str(fd, "finalDays"), 1, 60);
  const contractDays = whole(str(fd, "contractDays"), 1, 60);
  if (!name) return fail("Enter the business name.");
  if (hold === null || hold === "bad") return fail("Holds last 1 to 720 hours.");
  if (deposit === null || deposit === "bad" || deposit === 0) return fail("Enter the deposit amount.");
  if (finalDays === null || finalDays === "bad" || contractDays === null || contractDays === "bad") {
    return fail("Reminder days are 1 to 60.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name, hold_hours: hold, deposit_cents: deposit, final_days: finalDays, contract_days: contractDays })
    .eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done();
}

/** Business profile: shown on the screens, the contract, and the reports. */
export async function saveProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const color = str(fd, "brandColor");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return fail("Choose a brand color.");
  const opt = (k: string, max: number) => {
    const v = str(fd, k);
    return v ? v.slice(0, max) : null;
  };
  const email = opt("email", 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("That email address doesn't look right.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      tagline: opt("tagline", 120),
      phone: opt("phone", 40),
      email,
      website: opt("website", 120),
      address: opt("address", 200),
      brand_color: color,
    })
    .eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done();
}

/** Event types offered in the booking form. "Other" is always offered. */
export async function saveEventTypes(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const picked = new Set(fd.getAll("occasion").map(String));
  const occasions = ALL_OCCASIONS.filter((o) => picked.has(o) && o !== "other");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ occasions: [...occasions, "other"] })
    .eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done();
}

/** Waiter prices and sales tax, used in every estimate and contract. */
export async function saveStaffingTax(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const rate = dollars(str(fd, "waiterRate"));
  const min = whole(str(fd, "waiterMin"), 0, 50);
  const hours = whole(str(fd, "waiterHours"), 1, 24);
  const extra = dollars(str(fd, "waiterExtraHour"));
  const taxRaw = str(fd, "salesTax");
  const tax = taxRaw ? Number(taxRaw.replace(/[%\s]/g, "")) : 0;
  if (rate === "bad" || extra === "bad") return fail("Check the waiter prices.");
  if (min === "bad") return fail("The waiter minimum is 0 to 50.");
  if (hours === "bad") return fail("Hours included is 1 to 24.");
  if (!Number.isFinite(tax) || tax < 0 || tax > 30) return fail("Sales tax is 0 to 30 percent.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      waiter_rate_cents: rate ?? 0,
      waiter_min: min ?? 0,
      waiter_hours_included: hours ?? 4,
      waiter_extra_hour_cents: extra,
      sales_tax_percent: Math.round(tax * 1000) / 1000,
    })
    .eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done();
}

/** Upcoming hold or booked parties at a venue or in a slot. */
async function upcomingCount(column: "venue_id" | "slot_id", id: string, timeZone: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq(column, id)
    .gte("event_date", todayIn(timeZone))
    .in("status", ["hold", "booked"]);
  return count ?? 0;
}

async function orgTimeZone(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("timezone").eq("id", orgId).single();
  return data?.timezone ?? "America/New_York";
}

function venueFields(fd: FormData) {
  const name = str(fd, "name");
  const code = str(fd, "code").toUpperCase();
  const color = str(fd, "color");
  const fee = dollars(str(fd, "fee"));
  const slotKeys = fd.getAll("slots").map(String);
  const allSlots = str(fd, "allSlotCount");
  if (!name) return { error: "Enter the venue name." } as const;
  if (!/^[A-Z0-9]{1,2}$/.test(code)) return { error: "The letter is 1 or 2 letters or numbers." } as const;
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Choose a color." } as const;
  if (fee === "bad") return { error: "Check the fee." } as const;
  if (!slotKeys.length) return { error: "Choose at least one time of day." } as const;
  return {
    row: {
      name,
      code,
      color,
      extra_fee_cents: fee ?? 0,
      // All slots ticked is stored as "no limit", so new slots are included.
      slot_keys: String(slotKeys.length) === allSlots ? null : slotKeys,
    },
  } as const;
}

export async function saveVenue(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const id = z.uuid().safeParse(str(fd, "id"));
  if (!id.success) return fail("Unknown venue.");
  const f = venueFields(fd);
  if ("error" in f) return fail(f.error!);
  const active = fd.get("active") === "on";
  if (!active) {
    const n = await upcomingCount("venue_id", id.data, await orgTimeZone(me.orgId));
    if (n) return fail(`${n} upcoming ${n === 1 ? "party is" : "parties are"} booked here. Move or cancel them first.`);
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("venues")
    .update({ ...f.row, active })
    .eq("id", id.data);
  if (error?.code === "23505") return fail("Another venue already uses that name or letter.");
  return error ? fail("Couldn't save. Please try again.") : done();
}

export async function addVenue(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const f = venueFields(fd);
  if ("error" in f) return fail(f.error!);
  const kind = z.enum(["event_space", "catering", "other"]).safeParse(str(fd, "kind"));
  if (!kind.success) return fail("Choose the kind of venue.");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("venues")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("venues").insert({
    ...f.row,
    org_id: me.orgId,
    kind: kind.data,
    exclusive: kind.data !== "other",
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error?.code === "23505") return fail("Another venue already uses that name or letter.");
  return error ? fail("Couldn't add the venue. Please try again.") : done(`Added ${f.row.name}.`);
}

export async function saveSlot(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const id = z.uuid().safeParse(str(fd, "id"));
  if (!id.success) return fail("Unknown time of day.");
  const label = str(fd, "label");
  const earliest = minutes(str(fd, "earliest"));
  const latest = minutes(str(fd, "latest"));
  const endBy = minutes(str(fd, "endBy"));
  const maxHours = Number(str(fd, "maxHours"));
  const maxGuests = whole(str(fd, "maxGuests"), 1, 5000);
  const weekdays = days(fd, "weekdays");
  const winterOnly = days(fd, "winterOnly").filter((d) => weekdays.includes(d));
  const styles = fd.getAll("styles").map(String);
  const allStyles = z.array(z.enum(["plated", "family", "buffet", "bris"])).safeParse(styles);

  if (!label) return fail("Enter a name.");
  if (earliest === null || earliest === "bad" || latest === null || latest === "bad") {
    return fail("Enter the start window.");
  }
  if (latest < earliest) return fail("The latest start can't be before the earliest.");
  if (endBy === "bad") return fail("Check the finish-by time.");
  if (endBy !== null && endBy <= latest) return fail("Parties must be able to finish after the latest start.");
  if (!Number.isFinite(maxHours) || maxHours < 0.5 || maxHours > 12 || (maxHours * 2) % 1) {
    return fail("The longest party is 0.5 to 12 hours, in half hours.");
  }
  if (maxGuests === "bad") return fail("Check the guest limit.");
  if (!weekdays.length) return fail("Choose at least one day of the week.");
  if (!allStyles.success || !styles.length) return fail("Choose at least one party style.");

  const active = fd.get("active") === "on";
  if (!active) {
    const n = await upcomingCount("slot_id", id.data, await orgTimeZone(me.orgId));
    if (n) return fail(`${n} upcoming ${n === 1 ? "party uses" : "parties use"} this time of day. Move or cancel them first.`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("slots")
    .update({
      label,
      start_earliest: earliest,
      start_latest: latest,
      end_latest: endBy,
      max_minutes: Math.round(maxHours * 60),
      max_guests: maxGuests,
      weekdays,
      standard_time_only_weekdays: winterOnly,
      allowed_styles: allStyles.data,
      active,
    })
    .eq("id", id.data);
  return error ? fail("Couldn't save. Please try again.") : done();
}

export async function saveContractTerms(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const terms = String(fd.get("terms") ?? "").replace(/\r\n/g, "\n").trim();
  if (terms.length > 20000) return fail("The terms are too long (20,000 characters at most).");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ contract_terms: terms || null }).eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done();
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function saveReminder(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const hour = whole(str(fd, "hour"), 0, 23);
  const emails = str(fd, "emails")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const whatsapp = str(fd, "whatsapp");
  if (hour === null || hour === "bad") return fail("Choose a time.");
  const bad = emails.find((e) => !EMAIL.test(e));
  if (bad) return fail(`"${bad}" doesn't look like an email address.`);
  if (emails.length > 10) return fail("Up to 10 email addresses.");
  if (whatsapp && !/@g\.us$/.test(whatsapp) && whatsapp.replace(/\D/g, "").length < 10) {
    return fail("Enter the WhatsApp number with its country code (e.g. 1 732 555 0100), or a group id.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      reminder_enabled: fd.get("enabled") === "on",
      reminder_hour: hour,
      reminder_emails: [...new Set(emails)],
      reminder_whatsapp: whatsapp || null,
    })
    .eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done();
}

export type TestResult = { results: { channel: string; status: string; detail: string }[] };

export async function sendTestReminder(): Promise<TestResult> {
  const me = await requireRole("admin");
  const { sendReminder } = await import("@/lib/reminder-send");
  const { results } = await sendReminder(await createClient(), me.orgId);
  return { results };
}

/** Holiday gratuity and Chanukah prices. */
export async function saveHolidayPricing(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const pct = Number(str(fd, "gratuity"));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return fail("The holiday gratuity is 0 to 100 percent.");
  const allowed = new Set(HOLIDAY_OPTIONS.map((o) => o.key as string));
  const daysOn = fd.getAll("holiday").map(String).filter((k) => allowed.has(k));
  const prices: Record<string, number> = {};
  for (const style of ["plated", "family", "buffet"]) {
    const v = dollars(str(fd, `chanukah_${style}`));
    if (v === "bad") return fail("Check the Chanukah prices.");
    if (v) prices[style] = v;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ holiday_gratuity_percent: pct, holiday_gratuity_days: daysOn, chanukah_prices: prices })
    .eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done();
}

/** WhatsApp messages to clients. Turning them on needs the sending number confirmed. */
export async function saveClientMessages(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const enabled = fd.get("enabled") === "on";
  const confirmed = fd.get("confirm") === "on";
  const number = sendingNumber();
  const hour = whole(str(fd, "hour"), 0, 23);
  const days = whole(str(fd, "beforeDays"), 3, 60);
  const before = str(fd, "beforeText");
  const after = str(fd, "afterText");
  if (hour === null || hour === "bad") return fail("Choose the hour to send.");
  if (days === null || days === "bad") return fail("Send the first message 3 to 60 days before.");
  if (!before || !after) return fail("Write both messages.");
  if (before.length > 1500 || after.length > 1500) return fail("Keep each message under 1,500 characters.");
  if (enabled && !number) return fail("WhatsApp isn’t connected on the server yet.");
  if (enabled && !confirmed) return fail("Tick the box confirming the number messages are sent from.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      client_msgs_enabled: enabled,
      client_msgs_confirmed_number: confirmed && number ? number : null,
      client_msg_hour: hour,
      client_before_enabled: fd.get("beforeOn") === "on",
      client_before_days: days,
      client_before_text: before,
      client_after_enabled: fd.get("afterOn") === "on",
      client_after_text: after,
    })
    .eq("id", me.orgId);
  return error ? fail("Couldn't save. Please try again.") : done(enabled ? "Saved. Messages to clients are on." : "Saved.");
}

/** Sends the "before" message, with sample details, to a number you choose. */
export async function sendClientMessageTest(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const to = clientChatId(str(fd, "to"));
  if (!to) return fail("Enter a phone number with the area code.");
  if (!sendingNumber()) return fail("WhatsApp isn’t connected on the server yet.");
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, client_before_text")
    .eq("id", me.orgId)
    .single();
  if (!org) return fail("Couldn't load the settings.");
  const text = fillTemplate(org.client_before_text, {
    first_name: "Sarah",
    business: org.name,
    date: "Sunday, March 7",
    due_date: "Sunday, February 28",
    link: "(the client’s private link)",
    balance: "$1,724",
    balance_line: "Your remaining balance is $1,724.",
  });
  const r = await periskopeSend(to, `[Test] ${text}`);
  return r.ok ? done("Test sent.") : fail(`WhatsApp didn’t accept it${r.status ? ` (${r.status})` : ""}.`);
}
