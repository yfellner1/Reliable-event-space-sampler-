"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authEmailDomain } from "@/lib/env";
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/usernames";

export type LoginState = { error?: string; username?: string };

const WRONG = "That username and password don't match. Check both and try again.";

/** Only allow redirects back into this app, never to another site. */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Enter your username and password.", username };
  }
  if (!isValidUsername(username)) {
    return { error: WRONG, username };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username, authEmailDomain()),
    password,
  });
  if (error) {
    // Banned (deactivated) accounts and wrong passwords get the same message,
    // so the login form does not reveal which usernames exist.
    if (error.status === 429) {
      return { error: "Too many attempts. Wait a few minutes and try again.", username };
    }
    return { error: WRONG, username };
  }

  redirect(safeNext(formData.get("next")));
}
