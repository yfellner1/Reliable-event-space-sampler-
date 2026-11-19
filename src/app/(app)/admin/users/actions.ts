"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { authEmailDomain } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { ROLES } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  USERNAME_RULES,
  isValidUsername,
  normalizeUsername,
  passwordProblem,
  usernameToEmail,
} from "@/lib/usernames";

// Switched-off accounts are banned in Supabase Auth for 100 years, so they
// cannot sign in or refresh a session. Turning the account back on lifts it.
const BAN_FOREVER = "876000h";

const roleSchema = z.enum(ROLES as [string, ...string[]]);

function text(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

function dbMessage(error: { code?: string; hint?: string; message: string }): string {
  if (error.hint === "last_admin") return "There has to be at least one active admin.";
  if (error.hint === "self_demote") return "You can't remove your own admin access.";
  if (error.code === "23505") return "That username is already taken.";
  if (error.code === "42501") return "Only admins can do that.";
  return "Something went wrong. Please try again.";
}

export async function addUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const username = normalizeUsername(text(fd, "username"));
  const displayName = text(fd, "displayName");
  const role = roleSchema.safeParse(text(fd, "role"));
  const password = String(fd.get("password") ?? "");

  if (!displayName) return { error: "Enter the person's name." };
  if (!isValidUsername(username)) return { error: `Username: ${USERNAME_RULES}` };
  if (!role.success) return { error: "Choose a role." };
  const pw = passwordProblem(password);
  if (pw) return { error: `Password: ${pw}` };

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: usernameToEmail(username, authEmailDomain()),
    password,
    email_confirm: true,
    app_metadata: { org_id: me.orgId },
    user_metadata: { username, display_name: displayName },
  });
  if (authError || !created.user) {
    if (authError?.code === "email_exists" || authError?.status === 422) {
      return { error: "That username is already taken." };
    }
    console.error("createUser failed", authError);
    return { error: "Couldn't create the login. Please try again." };
  }

  // Attach the profile as the signed-in admin, so the audit log shows who added it.
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_member", {
    p_user_id: created.user.id,
    p_username: username,
    p_display_name: displayName,
    p_role: role.data as (typeof ROLES)[number],
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: dbMessage(error) };
  }

  revalidatePath("/admin/users");
  return {
    ok: `Added ${displayName}. They sign in with the username "${username}" and the password you set.`,
    stamp: Date.now(),
  };
}

export async function updateUser(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = z.uuid().safeParse(text(fd, "id"));
  const displayName = text(fd, "displayName");
  const role = roleSchema.safeParse(text(fd, "role"));
  const active = text(fd, "active") === "on";

  if (!id.success) return { error: "Unknown user." };
  if (!displayName) return { error: "Enter the person's name." };
  if (!role.success) return { error: "Choose a role." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_member", {
    p_user_id: id.data,
    p_display_name: displayName,
    p_role: role.data as (typeof ROLES)[number],
    p_active: active,
  });
  if (error) return { error: dbMessage(error) };

  // The profile change succeeded, so this user is in the admin's organization.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(id.data, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (banError) {
    console.error("ban update failed", banError);
    return { error: "Saved, but couldn't update their sign-in access. Please try again." };
  }

  revalidatePath("/admin/users");
  return { ok: "Saved.", stamp: Date.now() };
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const id = z.uuid().safeParse(text(fd, "id"));
  const password = String(fd.get("password") ?? "");
  if (!id.success) return { error: "Unknown user." };
  const pw = passwordProblem(password);
  if (pw) return { error: pw };

  // Row-level security only returns profiles in the admin's own organization.
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", id.data)
    .maybeSingle();
  if (!target) return { error: "Unknown user." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(target.id, { password });
  if (error) {
    console.error("password reset failed", error);
    return { error: "Couldn't change the password. Please try again." };
  }
  await admin.from("audit_log").insert({
    org_id: me.orgId,
    table_name: "auth.users",
    row_id: target.id,
    action: "update",
    actor_id: me.id,
    new_data: { password_reset: true, username: target.username },
  });

  return { ok: `New password set for ${target.username}.`, stamp: Date.now() };
}
