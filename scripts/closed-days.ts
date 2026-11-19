/**
 * Prints SQL rows of yom tov closures for a range of years.
 *   npx tsx scripts/closed-days.ts 2026 2045
 */
import { addDays, toISODate } from "../src/lib/dates";
import { yomTovClosure } from "../src/lib/holidays";

const [from, to] = process.argv.slice(2).map(Number);
const rows: string[] = [];
for (let d = toISODate(from, 1, 1); d <= toISODate(to, 12, 31); d = addDays(d, 1)) {
  const c = yomTovClosure(d);
  if (c) rows.push(`  ('${d}', ${c.eveningOnly}, '${c.reason.replace(/'/g, "''")}')`);
}
console.log(rows.join(",\n"));
