"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { requireMember } from "@/lib/auth";
import { authEmailDomain, supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { passwordProblem, usernameToEmail } from "@/lib/usernames";

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireMember();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  const problem = passwordProblem(next);
  if (problem) return { error: `New password: ${problem}` };
  if (next !== confirm) return { error: "The two new passwords don't match." };

  // Check the current password with a throwaway client, so a wrong guess
  // cannot disturb the signed-in session.
  const check = createStatelessClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await check.auth.signInWithPassword({
    email: usernameToEmail(me.username, authEmailDomain()),
    password: current,
  });
  if (wrong) return { error: "Your current password isn't right." };
  await check.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you haven't used here." };
    return { error: "Couldn't change your password. Please try again." };
  }
  return { ok: "Password changed.", stamp: Date.now() };
}
