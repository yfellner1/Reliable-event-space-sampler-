import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clock, money } from "@/lib/format";

export const metadata: Metadata = { title: "Locations and times" };

export default async function InfoPage() {
  const member = await requireMember();
  const supabase = await createClient();
  const [{ data: venues }, { data: slots }] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name, code, color, kind, extra_fee_cents")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("slots")
      .select("id, label, start_earliest, start_latest, end_latest, max_minutes")
      .eq("active", true)
      .order("sort_order"),
  ]);
  const showPrices = member.role !== "kitchen";

  return (
    <div className="grid gap-4">
      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Locations</h2>
        <ul className="grid gap-2">
          {venues?.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white"
                  style={{ background: v.color }}
                >
                  {v.code}
                </span>
                {v.name}
              </span>
              {showPrices ? (
                <span className="text-sm text-muted">
                  {v.kind === "other"
                    ? "Fee set per booking"
                    : v.extra_fee_cents
                      ? `+${money(v.extra_fee_cents)}`
                      : "No extra fee"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Party times</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
          {slots?.map((s) => (
            <div key={s.id} className="contents">
              <dt className="font-semibold">{s.label}</dt>
              <dd className="m-0 text-right text-muted">
                {s.start_earliest === s.start_latest
                  ? `Starts ${clock(s.start_earliest)}`
                  : `Starts ${clock(s.start_earliest)} to ${clock(s.start_latest)}`}
                {s.end_latest ? `, done by ${clock(s.end_latest)}` : ""}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
