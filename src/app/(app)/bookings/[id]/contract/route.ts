import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { loadBookingMenu, loadMenuLines, loadMenus, loadSetup } from "@/lib/booking-data";
import { contractData } from "@/lib/contract-data";
import { contractPdf } from "@/lib/contract-pdf";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** The contract PDF, built from the saved booking. Editors and admins only. */
export async function GET(_req: Request, ctx: RouteContext<"/bookings/[id]/contract">) {
  const me = await requireRole("admin", "editor");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const [{ data: b }, { data: org }, setup, menus, choices, lines] = await Promise.all([
    supabase.from("bookings").select("*").eq("id", id).maybeSingle(),
    supabase.from("organizations").select("contract_terms").eq("id", me.orgId).single(),
    loadSetup(me),
    loadMenus(),
    loadBookingMenu(id),
    loadMenuLines([id]),
  ]);
  if (!b) return new NextResponse("Not found", { status: 404 });

  const pdf = await contractPdf(
    contractData(b, setup, menus, choices, lines.get(id) ?? [], org?.contract_terms ?? "", todayIn(setup.org.timeZone)),
  );
  const file = `Contract ${b.client_last_name} ${b.event_date}.pdf`.replace(/[^\w .-]/g, "");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
