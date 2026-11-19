// Turns a Google Calendar export (.ics, or the .zip Google gives you) into
// bookings to import. Runs in the browser: the file never leaves the device,
// and card numbers written in the calendar are dropped before anything is
// shown or sent.

import { addDays, toISODate, type ISODate } from "./dates";
import type { PartyStyle, PaymentMethod } from "./schedule";

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string;
  status: string;
  /** Local date and minutes after midnight, or null for all-day events. */
  start: { date: ISODate; minute: number } | null;
  end: { date: ISODate; minute: number } | null;
  created: ISODate | null;
  recurring: boolean;
};

export type VenueKey = "event_space" | "novel" | "catering";
export type SlotKey = "morning" | "afternoon" | "evening";

export type ImportRow = {
  ref: string;
  title: string;
  date: ISODate;
  startMinute: number;
  durationMinutes: number;
  slotKey: SlotKey;
  venueKey: VenueKey;
  venueAddress: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  style: PartyStyle;
  men: number;
  women: number;
  children: number;
  menuNotes: string;
  notes: string;
  deposit: { method: PaymentMethod; amountCents: number; receivedOn: ISODate } | null;
  /** Things to check by hand. Also written into the booking's notes. */
  warnings: string[];
};

export type Skipped = { date: ISODate | null; title: string; reason: string };

// ---------------------------------------------------------------- .ics

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Wall-clock date and minute of an instant in a time zone. */
function localParts(instant: Date, timeZone: string): { date: ISODate; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: toISODate(+parts.year, +parts.month, +parts.day),
    minute: (+parts.hour % 24) * 60 + +parts.minute,
  };
}

function parseWhen(params: string, value: string, timeZone: string): { date: ISODate; minute: number } | null {
  if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(value)) return null; // all-day
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z) return localParts(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), timeZone);
  // Floating or TZID time: Google exports these in the calendar's own zone,
  // which for this business is the organization's zone.
  return { date: toISODate(+y, +mo, +d), minute: +h * 60 + +mi };
}

export function parseIcs(text: string, timeZone: string): IcsEvent[] {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const out: IcsEvent[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const props = new Map<string, { params: string; value: string }>();
    for (const line of body.split("\n")) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const key = line.slice(0, colon);
      const name = key.split(";")[0].toUpperCase();
      if (!props.has(name)) props.set(name, { params: key, value: line.slice(colon + 1) });
    }
    const get = (n: string) => props.get(n)?.value ?? "";
    const created = get("CREATED").match(/^(\d{4})(\d{2})(\d{2})/);
    out.push({
      uid: get("UID"),
      summary: unescapeText(get("SUMMARY")).trim(),
      description: unescapeText(get("DESCRIPTION")),
      status: get("STATUS").toUpperCase(),
      start: props.has("DTSTART") ? parseWhen(props.get("DTSTART")!.params, get("DTSTART"), timeZone) : null,
      end: props.has("DTEND") ? parseWhen(props.get("DTEND")!.params, get("DTEND"), timeZone) : null,
      created: created ? toISODate(+created[1], +created[2], +created[3]) : null,
      recurring: props.has("RRULE"),
    });
  }
  return out;
}

// ---------------------------------------------------------------- .zip

/** The .ics files inside a zip (stored or deflated entries). */
export async function icsFromZip(data: ArrayBuffer): Promise<string[]> {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  // End of central directory: scan back for its signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That file isn’t a zip.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const texts: string[] = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.ics$/i.test(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.slice(start, start + size);
    let out: Uint8Array;
    if (method === 0) out = raw;
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      out = new Uint8Array(await new Response(stream).arrayBuffer());
    } else continue;
    texts.push(new TextDecoder().decode(out));
  }
  return texts;
}

// ---------------------------------------------------------------- text helpers

function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

const CARD = /(?:\d[ -]?){13,19}/;
const CARD_DETAIL = /^\s*(?:exp\w*|cvv|sec\w*|zip|cc)?\s*[:.]?\s*[\d/ ]{2,24}\s*$/i;

/** Drops card numbers and the expiry, security code, and zip lines after them. */
export function stripCards(text: string): { text: string; hadCard: boolean } {
  const lines = text.split("\n");
  const out: string[] = [];
  let hadCard = false;
  for (let i = 0; i < lines.length; i++) {
    if (CARD.test(lines[i].replace(/[()]/g, ""))) {
      hadCard = true;
      let j = i + 1;
      while (j < lines.length && j <= i + 4 && (CARD_DETAIL.test(lines[j]) || !lines[j].trim())) j++;
      i = j - 1;
      continue;
    }
    out.push(lines[i]);
  }
  return { text: out.join("\n"), hadCard };
}

const PHONE = /(?:\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/g;

function formatPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : raw.trim();
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
const MENU_LINE =
  /^\s*\+?\s*(bread|salads?|soups?|pizza|fish|pasta|desserts?|desert|app(?:etizers?|s)?|sides?|sushi|sundae|drinks)\s*[:\-+]/i;

/** A date like 10/25 or 11/17/26, placed in the year it was most likely written. */
function monthDay(m: string, d: string, y: string | undefined, created: ISODate | null): ISODate | null {
  const month = +m;
  const day = +d;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (y) return toISODate(y.length === 2 ? 2000 + +y : +y, month, day);
  const ref = created ?? null;
  if (!ref) return null;
  const year = +ref.slice(0, 4);
  const guess = toISODate(year, month, day);
  // Written on or a little after the day the event was created.
  return guess > addDays(ref, 45) ? toISODate(year - 1, month, day) : guess;
}

// ---------------------------------------------------------------- guests

function guestsFrom(text: string): { men: number; women: number; children: number; note: string | null } | null {
  const t = text.replace(/\s+/g, " ");
  const num = (re: RegExp) => {
    const m = t.match(re);
    return m ? +m[1] : null;
  };
  let men = num(/(\d+)\s*men\b/i);
  let women = num(/(\d+)\s*(?:wom[ae]n|ladies)\b/i);
  const kids =
    num(/(\d+)\s*(?:kids?|children)\b/i) ??
    ((num(/(\d+)\s*boys?\b/i) ?? 0) + (num(/(\d+)\s*girls?\b/i) ?? 0) || null);
  const couple = /\bC\s*&\s*K\b/i.test(t);
  if (men !== null || women !== null) {
    men = (men ?? 0) + (couple ? 1 : 0);
    women = (women ?? 0) + (couple ? 1 : 0);
    return { men, women, children: kids ?? 0, note: couple ? "Guest count includes the chosson and kallah." : null };
  }
  const adults = t.match(/(\d+)\s*adults?\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)/i);
  if (adults) return { men: +adults[2], women: +adults[3], children: kids ?? 0, note: null };
  const split = t.match(/guest count\s*:?\s*\d+\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)/i);
  if (split) return { men: +split[1], women: +split[2], children: kids ?? 0, note: null };
  const total =
    num(/guest count\s*:?\s*(\d+)/i) ?? num(/(\d+)\s*adults?\b/i) ?? num(/(\d+)\s*(?:ppl|people|guests)\b/i);
  if (total === null) return null;
  const isAdults = /(\d+)\s*adults?\b/i.test(t) && num(/guest count\s*:?\s*(\d+)/i) === null;
  const children = kids ?? 0;
  const grown = Math.max(0, isAdults ? total : total - children);
  return {
    men: Math.ceil(grown / 2),
    women: Math.floor(grown / 2),
    children,
    note: `The calendar gave ${grown} adults without a men/women split; it was split evenly.`,
  };
}

// ---------------------------------------------------------------- events to rows

function slotFor(minute: number): SlotKey {
  if (minute < 600) return "morning";
  if (minute < 1020) return "afternoon";
  return "evening";
}

const SKIP_TITLE = /gratuity|pricing/i;

export function toImportRows(
  events: IcsEvent[],
  opts: { from: ISODate; to?: ISODate; depositCents: number },
): { rows: ImportRow[]; skipped: Skipped[] } {
  const rows: ImportRow[] = [];
  const skipped: Skipped[] = [];
  const dayNotes: { date: ISODate; text: string }[] = [];

  const sorted = [...events].sort((a, b) =>
    `${a.start?.date ?? ""}${String(a.start?.minute ?? 0).padStart(4, "0")}`.localeCompare(
      `${b.start?.date ?? ""}${String(b.start?.minute ?? 0).padStart(4, "0")}`,
    ),
  );

  for (const e of sorted) {
    if (!e.start || !e.end) continue; // all-day: holidays and reminders
    if (e.start.date < opts.from || (opts.to && e.start.date > opts.to)) continue;
    if (e.status === "CANCELLED") continue;
    const title = e.summary.replace(/\s+/g, " ").trim();
    if (e.recurring) {
      skipped.push({ date: e.start.date, title, reason: "Repeating calendar entry, not a party." });
      continue;
    }
    if (SKIP_TITLE.test(title)) {
      skipped.push({ date: e.start.date, title, reason: "A note, not a party." });
      dayNotes.push({ date: e.start.date, text: title });
      continue;
    }

    const warnings: string[] = [];
    const { text: desc, hadCard } = stripCards(htmlToText(e.description));
    const summary = e.summary.replace(/\n/g, " ");

    // Phones: the title first, then the notes.
    const phones = [...summary.matchAll(PHONE)].map((m) => formatPhone(m[0]));
    if (!phones.length) phones.push(...[...desc.matchAll(PHONE)].map((m) => formatPhone(m[0])).slice(0, 1));

    // Venue.
    const catering = /outside\s+catering/i.test(summary);
    const venueKey: VenueKey = catering ? "catering" : /novel/i.test(summary) ? "novel" : "event_space";

    // Name and address from the title.
    let rest = summary.replace(PHONE, " ");
    let venueAddress = "";
    let lastName: string;
    const tags: string[] = [];
    if (catering) {
      rest = rest
        .replace(/outside\s+catering/i, " ")
        .replace(/\b\d+\s*(?:ppl|people)\b/i, " ")
        .replace(/^[\s,:-]+|[\s,:-]+$/g, "")
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s{2,}/g, " ")
        .trim();
      venueAddress = rest;
      lastName = "Outside catering";
      warnings.push("No client name in the calendar.");
    } else {
      rest = rest.replace(/\((novel\w*)\)/i, " ");
      if (/\bSB\b/.test(rest)) tags.push("Sheva brachos");
      if (/\bBM\b/.test(rest)) tags.push("Bar mitzvah");
      rest = rest.replace(/\b(SB|BM)\b/g, " ");
      lastName = rest
        .replace(/\s*:\s*/g, " ")
        .replace(/^[\s\-–]+|[\s\-–]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!lastName) {
        lastName = "No name";
        warnings.push("No client name in the calendar.");
      }
    }
    if (!phones.length) warnings.push("No phone number in the calendar.");

    // Email.
    const email = (desc.match(EMAIL)?.[0] ?? "").toLowerCase();

    // Style.
    const style: PartyStyle = /family/i.test(desc) ? "family" : /buffet/i.test(desc) ? "buffet" : "plated";

    // Guests.
    const g = guestsFrom(`${summary}\n${desc}`);
    if (g?.note?.startsWith("The calendar gave")) warnings.push(g.note);

    // Deposit.
    const lower = desc.toLowerCase();
    const amount = [...desc.matchAll(/\$\s?(\d{2,5})(?!\s*\/\s*p)/gi)].map((m) => +m[1]).find((n) => n >= 100);
    let method: PaymentMethod | null = /zelle/.test(lower)
      ? "zelle"
      : /\bcash\b/.test(lower)
        ? "cash"
        : /\bcheck\b/.test(lower)
          ? "check"
          : hadCard || /\bcc\b/.test(lower)
            ? "credit_card"
            : null;
    const paid = Boolean(amount || method || /deposit/.test(lower));
    let deposit: ImportRow["deposit"] = null;
    if (paid) {
      if (!method) {
        method = "cash";
        warnings.push("The calendar doesn’t say how the deposit was paid; set to cash.");
      }
      if (/bringing[^\n]*check/.test(lower)) warnings.push("The calendar says the check was still being brought in.");
      let receivedOn: ISODate | null = null;
      const paidOn =
        desc.match(/(?:paid|received|recieved|brought)[^\n]*?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i) ??
        desc.match(/\$\s?\d+\s*(?:zelle|cash|check)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i) ??
        desc.match(/book\w*(?:\s+on)?\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
      if (paidOn) receivedOn = monthDay(paidOn[1], paidOn[2], paidOn[3], e.created);
      receivedOn ??= e.created ?? e.start.date;
      deposit = { method, amountCents: (amount ?? opts.depositCents / 100) * 100, receivedOn };
      if (!amount) warnings.push(`No deposit amount in the calendar; set to $${opts.depositCents / 100}.`);
    } else {
      warnings.push("No deposit in the calendar; imported as a hold (needs deposit).");
    }

    // Split the notes: menu lines, the rest.
    const menuLines: string[] = [];
    const noteLines: string[] = [];
    for (const raw of desc.split("\n")) {
      const line = raw.trim();
      if (!line) {
        noteLines.push("");
        continue;
      }
      if (MENU_LINE.test(line)) menuLines.push(line);
      else if (email && line.toLowerCase() === email) continue;
      else noteLines.push(line);
    }
    if (phones.length > 1) noteLines.push(`Other phone: ${phones.slice(1).join(", ")}`);
    if (tags.length) noteLines.unshift(tags.join(", "));
    if (g?.note && !g.note.startsWith("The calendar gave")) noteLines.push(g.note);

    const start = e.start.minute;
    let duration =
      e.end.date === e.start.date ? e.end.minute - start : e.end.minute + 1440 - start;
    duration = Math.min(720, Math.max(30, duration));

    rows.push({
      ref: `gcal:${e.uid}`,
      title,
      date: e.start.date,
      startMinute: start,
      durationMinutes: duration,
      slotKey: slotFor(start),
      venueKey,
      venueAddress,
      firstName: "",
      lastName,
      phone: phones[0] ?? "Not in calendar",
      email,
      style,
      men: g?.men ?? 0,
      women: g?.women ?? 0,
      children: g?.children ?? 0,
      menuNotes: menuLines.join("\n"),
      notes: tidy(noteLines.join("\n")),
      deposit,
      warnings,
    });
  }

  // Notes like "27% gratuity" go on that day's party, when there is one.
  for (const n of dayNotes) {
    const same = rows.filter((r) => r.date === n.date);
    if (same.length === 1) same[0].notes = tidy(`${same[0].notes}\nCalendar note for the day: ${n.text}`);
  }

  // Two parties in the same place and time of day.
  for (const r of rows) {
    const twin = rows.find((o) => o !== r && o.date === r.date && o.slotKey === r.slotKey && o.venueKey === r.venueKey);
    if (twin && r.venueKey !== "catering") {
      r.warnings.push(`Same ${r.slotKey} as ${twin.lastName}. Both are imported.`);
    }
  }
  return { rows, skipped };
}

function tidy(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/** What goes in the booking's notes, with the things to check listed last. */
export function notesWithWarnings(r: ImportRow): string {
  const parts = [r.notes];
  if (r.warnings.length) parts.push(`Imported from the Google calendar. Check:\n- ${r.warnings.join("\n- ")}`);
  else parts.push("Imported from the Google calendar.");
  return parts.filter(Boolean).join("\n\n");
}
