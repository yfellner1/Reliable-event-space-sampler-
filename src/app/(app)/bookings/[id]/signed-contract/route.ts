import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Opens the signed contract through a link that expires after a minute. */
export async function GET(_req: Request, ctx: RouteContext<"/bookings/[id]/signed-contract">) {
  await requireRole("admin", "editor");
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: b } = await supabase.from("bookings").select("contract_file_path").eq("id", id).maybeSingle();
  if (!b?.contract_file_path) return new NextResponse("No signed contract on file.", { status: 404 });
  const { data } = await supabase.storage.from("contracts").createSignedUrl(b.contract_file_path, 60);
  if (!data?.signedUrl) return new NextResponse("Couldn't open the file.", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: { "Cache-Control": "no-store" } });
}
