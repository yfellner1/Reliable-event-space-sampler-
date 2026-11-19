import type { Metadata } from "next";
import { requireMember } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireMember();
  return (
    <div className="grid gap-4">
      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">My account</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted">Name</dt>
          <dd className="m-0">{me.displayName}</dd>
          <dt className="text-muted">Username</dt>
          <dd className="m-0">{me.username}</dd>
          <dt className="text-muted">Access</dt>
          <dd className="m-0">{ROLE_LABELS[me.role]}</dd>
        </dl>
      </section>
      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
