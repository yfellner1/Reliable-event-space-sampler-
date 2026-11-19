import { requireMember } from "@/lib/auth";
import { loadAttention, loadSetup } from "@/lib/booking-data";
import { brandCss } from "@/lib/brand";
import { ROLE_LABELS } from "@/lib/roles";
import { SideNav, type NavItem } from "@/components/side-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const member = await requireMember();

  const attention = member.role === "kitchen" ? 0 : (await loadAttention(member)).entries.length;
  const { org } = await loadSetup(member);
  const items: NavItem[] = [{ href: "/", label: "Calendar" }];
  if (member.role !== "kitchen") items.push({ href: "/attention", label: "Needs attention", count: attention });
  if (member.role !== "kitchen") items.push({ href: "/customers", label: "Customers" });
  if (member.role !== "kitchen") items.push({ href: "/waitlist", label: "Waitlist" });
  if (member.role !== "kitchen") items.push({ href: "/reports", label: "Reports" });
  items.push({ href: "/prep", label: "Prep sheet" });
  items.push({ href: "/info", label: "Locations & times" });
  if (member.role === "admin") {
    items.push({ href: "/admin/menus", label: "Menus" });
    items.push({ href: "/admin/settings", label: "Settings" });
    items.push({ href: "/admin/users", label: "Users" });
    items.push({ href: "/admin/import", label: "Import" });
  }
  items.push({ href: "/account", label: "My account" });

  return (
    <div className="mx-auto max-w-6xl px-4 md:flex md:gap-8">
      <style>{brandCss(org.profile.brandColor)}</style>
      <SideNav
        items={items}
        orgName={member.orgName || "Party bookings"}
        userLine={`${member.displayName} · ${ROLE_LABELS[member.role]}`}
      />
      <main className="min-w-0 flex-1 pt-5 pb-12 md:max-w-3xl">{children}</main>
    </div>
  );
}
