// The kitchen prep sheet: dishes added up across the parties in a date range.

import type { MenuLine } from "./menu";

export type PrepParty = {
  id: string;
  guests: { total: number };
  menu: MenuLine[];
};

export type PrepDish = { section: string; dish: string; parties: number; guests: number };

/** Each dish once, with how many parties chose it and how many guests they have. */
export function prepTotals(parties: PrepParty[]): PrepDish[] {
  const out = new Map<string, PrepDish>();
  const order: string[] = [];
  for (const p of parties) {
    for (const line of p.menu) {
      for (const dish of line.items) {
        const key = `${line.section}\u0000${dish}`;
        const row = out.get(key);
        if (row) {
          row.parties += 1;
          row.guests += p.guests.total;
        } else {
          out.set(key, { section: line.section, dish, parties: 1, guests: p.guests.total });
          order.push(key);
        }
      }
    }
  }
  // Keep the menu's section order (first time each section appears), then by guests.
  const sectionRank = new Map<string, number>();
  for (const k of order) {
    const s = out.get(k)!.section;
    if (!sectionRank.has(s)) sectionRank.set(s, sectionRank.size);
  }
  return order
    .map((k) => out.get(k)!)
    .sort((a, b) => sectionRank.get(a.section)! - sectionRank.get(b.section)! || b.guests - a.guests);
}
