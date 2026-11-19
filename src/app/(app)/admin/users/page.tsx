import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { AddUserForm, EditUserForm, ResetPasswordForm } from "./user-forms";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, active")
    .order("active", { ascending: false })
    .order("display_name");

  return (
    <div className="grid gap-4">
      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Add a user</h2>
        <AddUserForm />
      </section>

      <section className="panel">
        <h2 className="mb-1 text-lg font-bold">Users</h2>
        <p className="mt-0 mb-3 text-sm text-muted">{users?.length ?? 0} accounts</p>
        <ul className="m-0 grid list-none gap-0 p-0">
          {users?.map((u) => (
            <li key={u.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                  <span>
                    <strong className={u.active ? "" : "text-muted line-through"}>
                      {u.display_name}
                    </strong>
                    <span className="block text-sm text-muted">{u.username}</span>
                  </span>
                  <span className="flex gap-1.5">
                    {!u.active ? <span className="chip text-muted">Off</span> : null}
                    <span className="chip">{ROLE_LABELS[u.role]}</span>
                  </span>
                </summary>
                <div className="mt-3 grid gap-5 rounded-xl bg-soft p-4">
                  <EditUserForm user={u} isSelf={u.id === me.id} />
                  <ResetPasswordForm id={u.id} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
