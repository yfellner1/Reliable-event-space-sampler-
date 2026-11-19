// The daily reminder: what needs attention, and the parties today and
// tomorrow. Built as plain text (WhatsApp) and HTML (email).

import { shortDate, longDate, addDays, type ISODate } from "./dates";
import { clock } from "./format";
import type { AttentionItem } from "./attention";

export type ReminderParty = {
  date: ISODate;
  slotLabel: string;
  startMinute: number;
  venue: string;
  clientName: string;
  guests: number;
  status: "hold" | "booked";
};

export type ReminderEntry = {
  date: ISODate;
  slotLabel: string;
  venue: string;
  clientName: string;
  url: string;
  items: AttentionItem[];
};

export type ReminderInput = {
  orgName: string;
  today: ISODate;
  appUrl: string;
  entries: ReminderEntry[];
  parties: ReminderParty[];
};

export type Reminder = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function partyLine(p: ReminderParty) {
  return `${clock(p.startMinute)} ${p.venue}: ${p.clientName}, ${p.guests ? `${p.guests} guests` : "guest count not in"}${
    p.status === "hold" ? " (on hold)" : ""
  }`;
}

export function buildReminder(r: ReminderInput): Reminder {
  const urgent = r.entries.filter((e) => e.items.some((i) => i.level === "urgent"));
  const others = r.entries.filter((e) => !e.items.some((i) => i.level === "urgent"));
  const tomorrow = addDays(r.today, 1);
  const day = (d: ISODate) => r.parties.filter((p) => p.date === d);

  const subject = r.entries.length
    ? `${r.orgName} parties: ${r.entries.length} need attention${urgent.length ? `, ${urgent.length} urgent` : ""}`
    : `${r.orgName} parties: all on track`;

  // Plain text for WhatsApp (*bold*).
  const t: string[] = [];
  t.push(`*${r.orgName} parties, ${longDate(r.today)}*`);
  if (!r.entries.length) t.push("", "Nothing needs follow-up. Every upcoming party is on track.");
  const block = (title: string, list: ReminderEntry[]) => {
    if (!list.length) return;
    t.push("", `*${title}*`);
    for (const e of list) {
      t.push(`${shortDate(e.date)} ${e.slotLabel.toLowerCase()}, ${e.clientName} (${e.venue})`);
      for (const i of e.items) t.push(`${i.level === "urgent" ? "❗" : i.level === "ready" ? "✅" : "•"} ${i.text}`);
    }
  };
  block(`Urgent (${urgent.length})`, urgent);
  block(`Also to do (${others.length})`, others);
  for (const [label, d] of [
    ["Today", r.today],
    ["Tomorrow", tomorrow],
  ] as const) {
    const list = day(d);
    t.push("", `*${label}:* ${list.length ? "" : "no parties"}`.trimEnd());
    for (const p of list) t.push(partyLine(p));
  }
  t.push("", `Open the app: ${r.appUrl}/attention`);

  // HTML for email.
  const h: string[] = [];
  h.push(`<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c2a21;max-width:600px">`);
  h.push(`<h1 style="font-size:20px;color:#2c5e3f;margin:0 0 4px">${esc(r.orgName)} parties</h1>`);
  h.push(`<p style="margin:0 0 16px;color:#5c6a60">${esc(longDate(r.today))}</p>`);
  if (!r.entries.length) h.push(`<p>Nothing needs follow-up. Every upcoming party is on track.</p>`);
  const hblock = (title: string, list: ReminderEntry[], color: string) => {
    if (!list.length) return;
    h.push(`<h2 style="font-size:16px;margin:20px 0 8px;color:${color}">${esc(title)}</h2>`);
    for (const e of list) {
      h.push(
        `<div style="border:1px solid #d6ddd4;border-radius:10px;padding:10px 12px;margin:0 0 8px"><a href="${esc(e.url)}" style="color:#1c2a21;font-weight:600;text-decoration:none">${esc(
          `${shortDate(e.date)} ${e.slotLabel.toLowerCase()}, ${e.clientName}`,
        )}</a> <span style="color:#5c6a60">(${esc(e.venue)})</span><ul style="margin:6px 0 0;padding-left:18px">${e.items
          .map((i) => `<li${i.level === "urgent" ? ' style="color:#8a2318"' : ""}>${esc(i.text)}</li>`)
          .join("")}</ul></div>`,
      );
    }
  };
  hblock(`Urgent (${urgent.length})`, urgent, "#8a2318");
  hblock(`Also to do (${others.length})`, others, "#1c2a21");
  for (const [label, d] of [
    ["Today", r.today],
    ["Tomorrow", tomorrow],
  ] as const) {
    const list = day(d);
    h.push(`<h2 style="font-size:16px;margin:20px 0 8px">${label}</h2>`);
    h.push(
      list.length
        ? `<ul style="margin:0;padding-left:18px">${list.map((p) => `<li>${esc(partyLine(p))}</li>`).join("")}</ul>`
        : `<p style="margin:0;color:#5c6a60">No parties.</p>`,
    );
  }
  h.push(
    `<p style="margin:24px 0 0"><a href="${esc(r.appUrl)}/attention" style="background:#2c5e3f;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Open Needs attention</a></p></div>`,
  );

  return { subject, text: t.join("\n"), html: h.join("") };
}

/** A phone number becomes a WhatsApp chat id; a group id (...@g.us) is used as is. */
export function whatsappChatId(target: string): string {
  const t = target.trim();
  if (t.includes("@")) return t;
  return `${t.replace(/\D/g, "")}@c.us`;
}

/** The current hour (0-23) in a timezone. */
export function hourIn(timeZone: string, now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
}
