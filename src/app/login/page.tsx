import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { BrandMark } from "@/components/brand-mark";
import { brandCss } from "@/lib/brand";
import { publicProfile } from "@/lib/public-profile";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  inactive: "This account is switched off. Ask an admin to turn it back on.",
  signedout: "You're signed out.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  const profile = await publicProfile();

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4 py-10">
      <style>{brandCss(profile.brandColor)}</style>
      <div className="flex items-center gap-4">
        <BrandMark name={profile.name} size={64} />
        <div>
          <h1 className="text-3xl font-bold text-brand">Event bookings</h1>
          <p className="mt-1 mb-0 text-muted">{profile.name}</p>
        </div>
      </div>
      <section className="panel">
        <LoginForm next={next} notice={reason ? NOTICES[reason] : undefined} />
      </section>
      <p className="text-sm text-muted">Forgot your password? Ask an admin to reset it.</p>
    </main>
  );
}
