import type { Database } from "@/lib/supabase/database.types";

export type Role = Database["public"]["Enums"]["member_role"];

export const ROLES: Role[] = ["admin", "editor", "kitchen"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  kitchen: "Kitchen staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Everything, plus users, venues, rules, and pricing.",
  editor: "Create and edit bookings, track deposits and contracts.",
  kitchen: "See booked parties, guest counts, and menus. Can leave notes. No prices.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}
