// Messages to clients: filling in the wording and working out phone numbers.

export const PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: "{first_name}", meaning: "client’s first name (or last name if there’s none)" },
  { key: "{business}", meaning: "business name" },
  { key: "{date}", meaning: "party date" },
  { key: "{due_date}", meaning: "date the guest count and menu are due" },
  { key: "{link}", meaning: "the client’s private link (made if needed)" },
  { key: "{balance}", meaning: "balance still due" },
  { key: "{balance_line}", meaning: "“Your remaining balance is $…” when there is one" },
];

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (all, key: string) => (key in vars ? vars[key] : all))
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** Digits only; a US number without the 1 gets it. */
export function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `1${d}` : d;
}

/** A WhatsApp chat id for a client's phone, or null when it isn't a usable number. */
export function clientChatId(phone: string): string | null {
  const d = phoneDigits(phone);
  return d.length >= 11 && d.length <= 15 ? `${d}@c.us` : null;
}

/** "+1 (732) 226-8111" for a US number, "+…" otherwise. */
export function displayPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return d ? `+${d}` : "";
}
