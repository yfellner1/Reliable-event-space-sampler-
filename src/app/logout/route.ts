import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST from the Sign out button. GET is used when an account turns out to be
// switched off, to clear the session and explain why.
async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("reason") === "inactive" ? "inactive" : "signedout";
  return NextResponse.redirect(new URL(`/login?reason=${reason}`, request.url), { status: 303 });
}

export const POST = signOut;
export const GET = signOut;
