/**
 * Daily reminder: settings, test send, and the hourly job. Email and
 * WhatsApp go to a fake service on port 3199 (see playwright.config.ts).
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { openNav } from "./nav";
import { hourIn } from "../../src/lib/reminder";
import { RUN, KALAMATA_ORG, booking, ids, makeUser, service } from "../db/helpers";
import { addDays, todayIn, weekday } from "../../src/lib/dates";
import { yomTovClosure } from "../../src/lib/holidays";

type Captured = { path: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> };
const captured: Captured[] = [];
let fake: Server;

test.beforeAll(async () => {
  fake = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      captured.push({ path: req.url ?? "", headers: req.headers, body: JSON.parse(raw || "{}") });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"id":"fake"}');
    });
  });
  await new Promise<void>((r) => fake.listen(3199, "127.0.0.1", r));
});

test.afterAll(async () => {
  await new Promise<void>((r) => fake.close(() => r()));
  await service
    .from("organizations")
    .update({
      reminder_enabled: false,
      reminder_emails: [],
      reminder_whatsapp: null,
      last_reminder_on: null,
      client_msgs_enabled: false,
      client_msgs_confirmed_number: null,
    })
    .eq("id", KALAMATA_ORG);
});

test.describe.configure({ mode: "serial" });

test("an admin sets up the reminder and sends a test", async ({ page }) => {
  const admin = await makeUser("admin", undefined, "reminder-admin");
  await page.goto("/login");
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-reminder-admin`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await openNav(page, "Settings");

  const section = page.getByRole("region", { name: "Daily reminder" });
  await expect(section.getByText("Email: connected.")).toBeVisible();
  await section.getByLabel("Send the daily reminder").check();
  await section.getByLabel("Email to (separate addresses with commas)").fill("not-an-email");
  await section.getByRole("button", { name: "Save reminder settings" }).click();
  await expect(section.getByText(`"not-an-email" doesn't look like an email address.`)).toBeVisible();
  // A refused save keeps what was entered.
  await expect(section.getByLabel("Send the daily reminder")).toBeChecked();
  await expect(section.getByLabel("Email to (separate addresses with commas)")).toHaveValue("not-an-email");

  await section.getByLabel("Email to (separate addresses with commas)").fill("Secretary@Example.com, owner@example.com");
  await section.getByLabel("WhatsApp to (number with country code, or a group id)").fill("1 (732) 555-0100");
  await section.getByRole("button", { name: "Save reminder settings" }).click();
  await expect(section.getByText("Saved.")).toBeVisible();
  const { data: org } = await service.from("organizations").select("reminder_enabled").eq("id", KALAMATA_ORG).single();
  expect(org!.reminder_enabled).toBe(true);

  captured.length = 0;
  await section.getByRole("button", { name: "Send a test now" }).click();
  await expect(section.getByText("Email: Sent.")).toBeVisible();
  await expect(section.getByText("WhatsApp: Sent.")).toBeVisible();

  const email = captured.find((c) => c.path === "/emails")!;
  expect(email.headers.authorization).toBe("Bearer test-resend-key");
  expect(email.body.to).toEqual(["secretary@example.com", "owner@example.com"]);
  expect(String(email.body.subject)).toMatch(/^Kalamata Café parties: /);
  expect(String(email.body.html)).toContain("Open Needs attention");

  const wa = captured.find((c) => c.path === "/periskope")!;
  expect(wa.headers.authorization).toBe("Bearer test-periskope-key");
  expect(wa.headers["x-phone"]).toBe("17325550199");
  expect(wa.body.chat_id).toBe("17325550100@c.us");
  expect(String(wa.body.message)).toMatch(/^\*Kalamata Café parties, /);

  await section.getByText("Preview today’s reminder").click();
  await page.screenshot({ path: "test-results/reminder-settings.png", fullPage: true });
});

test("the hourly job refuses callers without the secret", async ({ request }) => {
  const r = await request.get("/api/cron/daily-reminder");
  expect(r.status()).toBe(401);
});

test("the hourly job sends once, at the chosen hour", async ({ request }) => {
  const hour = hourIn("America/New_York");
  // Not the chosen hour: nothing is sent.
  await service
    .from("organizations")
    .update({
      reminder_enabled: true,
      reminder_emails: ["secretary@example.com"],
      reminder_whatsapp: "17325550100",
      reminder_hour: (hour + 1) % 24,
      last_reminder_on: null,
    })
    .eq("id", KALAMATA_ORG);
  captured.length = 0;
  const auth = { headers: { authorization: "Bearer test-cron-secret" } };
  let r = await request.get("/api/cron/daily-reminder", auth);
  expect(r.status()).toBe(200);
  expect(captured).toHaveLength(0);

  // The chosen hour: sent on both channels, and only once.
  await service.from("organizations").update({ reminder_hour: hour }).eq("id", KALAMATA_ORG);
  r = await request.get("/api/cron/daily-reminder", auth);
  expect((await r.json()).report).toContainEqual({ org: "Kalamata Café", result: "Email: sent, WhatsApp: sent" });
  expect(captured.map((c) => c.path).sort()).toEqual(["/emails", "/periskope"]);
  r = await request.get("/api/cron/daily-reminder", auth);
  expect((await r.json()).report).toContainEqual({ org: "Kalamata Café", result: "already sent today" });
  expect(captured).toHaveLength(2);
});

test("client WhatsApp messages: off until the number is confirmed, then sent once each", async ({ page, request }) => {
  const admin = await makeUser("admin", undefined, "msg-admin");
  const { venue, slot } = await ids();
  const today = todayIn("America/New_York");
  const pick = (from: number, step: number) => {
    let d = addDays(today, from);
    while (weekday(d) > 4 || yomTovClosure(d)) d = addDays(d, step);
    return d;
  };
  const tail = String(parseInt(RUN.slice(0, 4), 16) % 10000).padStart(4, "0");
  const party = (date: string, phoneTail: string, first: string) =>
    booking(venue("Other"), slot("afternoon"), date, {
      other_venue_name: "Hall",
      client_first_name: first,
      client_last_name: `Msg${RUN.slice(0, 4)}`,
      client_phone: `(848) 555-${phoneTail}`,
      status: "booked",
      hold_expires_at: null,
      deposit_paid: true,
      deposit_method: "zelle",
      deposit_amount_cents: 40000,
      deposit_received_on: addDays(today, -30),
      guests_men: 20,
      guests_women: 20,
    });
  const before = await service.from("bookings").insert(party(pick(5, 1), tail, "Esther")).select("id").single();
  expect(before.error).toBeNull();
  const afterTail = String((Number(tail) + 1) % 10000).padStart(4, "0");
  const after = await service.from("bookings").insert(party(pick(-1, -1), afterTail, "Miri")).select("id").single();
  expect(after.error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Password").fill(`pw-${RUN}-msg-admin`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await openNav(page, "Settings");
  const section = page.getByRole("region", { name: "WhatsApp messages to clients" });
  await expect(section.getByText("Off. Nothing is sent to clients", { exact: false })).toBeVisible();

  // Turning on without confirming the number is refused.
  await section.getByLabel("Send messages to clients automatically").check();
  await section.getByRole("button", { name: "Save client messages" }).click();
  await expect(section.getByText("Tick the box confirming the number", { exact: false })).toBeVisible();

  await section.getByLabel(/Messages are sent from \+1 \(732\) 555-0199/).check();
  await section.getByLabel("Send at (New York time)").selectOption(String(hourIn("America/New_York")));
  await section.getByRole("button", { name: "Save client messages" }).click();
  await expect(section.getByText("Saved. Messages to clients are on.")).toBeVisible();

  captured.length = 0;
  const auth = { headers: { authorization: "Bearer test-cron-secret" } };
  await request.get("/api/cron/daily-reminder", auth);
  const toEsther = captured.filter((c) => c.body.chat_id === `1848555${tail}@c.us`);
  expect(toEsther).toHaveLength(1);
  expect(String(toEsther[0].body.message)).toMatch(/^Hi Esther! [^]*guest count and menu[^]*\/c\/[A-Za-z0-9_-]{32}/);
  const toMiri = captured.filter((c) => c.body.chat_id === `1848555${afterTail}@c.us`);
  expect(toMiri).toHaveLength(1);
  expect(String(toMiri[0].body.message)).toMatch(/^Hi Miri, thank you [^]*Your remaining balance is \$1,724\./);

  // Each message goes once.
  captured.length = 0;
  await request.get("/api/cron/daily-reminder", auth);
  expect(captured.filter((c) => String(c.body.chat_id).startsWith("1848555"))).toHaveLength(0);

  // The booking shows what was sent.
  await page.goto(`/bookings/${before.data!.id}`);
  await expect(page.getByText(/guest count and menu reminder sent/)).toBeVisible();
});
