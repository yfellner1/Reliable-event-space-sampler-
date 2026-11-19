import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type Member = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  orgId: string;
  orgName: string;
};

/**
 * The signed-in, active member, or null. Cached for the length of one request.
 * Reads the profile through the user's own client, so it only succeeds for a
 * real, active account.
 */
const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

export const getMember = cache(async (): Promise<Member | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, active, org_id, organizations(name)")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || !profile.active) return null;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role,
    orgId: profile.org_id,
    orgName: profile.organizations?.name ?? "",
  };
});

/** The signed-in member, or a redirect to the login page. */
export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) {
    // Signed in, but the account has no active profile (switched off by an
    // admin): clear the session and say why.
    redirect((await getSessionUserId()) ? "/logout?reason=inactive" : "/login");
  }
  return member;
}

/** The signed-in member if they hold one of the roles, otherwise back home. */
export async function requireRole(...roles: Role[]): Promise<Member> {
  const member = await requireMember();
  if (!roles.includes(member.role)) redirect("/");
  return member;
}
