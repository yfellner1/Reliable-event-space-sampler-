"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { ALL_OCCASIONS } from "@/lib/schedule";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const on = (fd: FormData, k: string) => fd.get(k) === "on";

/** "$4.50" or "4.5" to 450 cents. Empty gives null. */
function cents(raw: string): number | null | "bad" {
  if (!raw) return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return "bad";
  return Math.round(n * 100);
}

function int(raw: string): number | null | "bad" {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : "bad";
}

const done = (msg = "Saved.") => {
  revalidatePath("/admin/menus");
  return { ok: msg, stamp: Date.now() };
};
const fail = (error: string): FormState => ({ error });

export async function updateMenu(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = z.uuid().safeParse(str(fd, "id"));
  const base = cents(str(fd, "base"));
  const sat = cents(str(fd, "saturday"));
  const min = int(str(fd, "min"));
  const satMin = int(str(fd, "saturdayMin"));
  const grat = Number(str(fd, "gratuity") || "0");
  const child = int(str(fd, "child"));
  const childPrice = cents(str(fd, "childPrice"));
  const minChildren = int(str(fd, "minChildren"));
  const perTable = int(str(fd, "perTable"));
  const picked = new Set(fd.getAll("occasion").map(String));
  const occasions = ALL_OCCASIONS.filter((o) => picked.has(o));
  if (!id.success) return fail("Unknown menu.");
  if (childPrice === "bad" || minChildren === "bad" || perTable === "bad") return fail("Check the numbers.");
  if (perTable !== null && (perTable < 1 || perTable > 50)) return fail("Guests per table is 1 to 50.");
  if (base === null || base === "bad") return fail("Enter the price.");
  if (sat === "bad" || min === "bad" || satMin === "bad" || child === "bad") return fail("Check the numbers.");
  if (!Number.isFinite(grat) || grat < 0 || grat > 100) return fail("Gratuity is a percent from 0 to 100.");
  if (child !== null && child > 100) return fail("Children's share is a percent from 0 to 100.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("menus")
    .update({
      base_price_cents: base,
      saturday_price_cents: sat,
      min_guests: min ?? 0,
      saturday_min_guests: satMin,
      gratuity_percent: grat,
      child_price_percent: child ?? 100,
      child_price_cents: childPrice,
      min_children: minChildren ?? 0,
      guests_per_table: perTable ?? 10,
      occasions: occasions.length ? occasions : null,
      included_note: str(fd, "included") || null,
    })
    .eq("id", id.data);
  return error ? fail("Couldn't save. Please try again.") : done();
}

function sectionFields(fd: FormData) {
  const name = str(fd, "name");
  const min = int(str(fd, "min"));
  const max = int(str(fd, "max"));
  const included = int(str(fd, "included"));
  const extra = cents(str(fd, "extra"));
  if (!name) return { error: "Enter a name." } as const;
  if (min === "bad" || max === "bad" || included === "bad" || extra === "bad") return { error: "Check the numbers." } as const;
  if (max !== null && (max < 1 || max < (min ?? 0))) return { error: "The most can't be less than the least." } as const;
  return {
    row: {
      name,
      note: str(fd, "note") || null,
      group_label: str(fd, "group") || null,
      min_choices: min ?? 0,
      max_choices: max,
      included_choices: extra === null ? null : (included ?? min ?? 0),
      extra_choice_price_cents: extra,
    },
  } as const;
}

export async function updateSection(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = z.uuid().safeParse(str(fd, "id"));
  if (!id.success) return fail("Unknown section.");
  const f = sectionFields(fd);
  if ("error" in f) return fail(f.error!);
  const supabase = await createClient();
  const { error } = await supabase.from("menu_sections").update(f.row).eq("id", id.data);
  return error ? fail("Couldn't save. Please try again.") : done();
}

export async function addSection(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const menuId = z.uuid().safeParse(str(fd, "menuId"));
  if (!menuId.success) return fail("Unknown menu.");
  const f = sectionFields(fd);
  if ("error" in f) return fail(f.error!);
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("menu_sections")
    .select("sort_order")
    .eq("menu_id", menuId.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("menu_sections")
    .insert({ ...f.row, menu_id: menuId.data, org_id: me.orgId, sort_order: (last?.sort_order ?? 0) + 1 });
  return error ? fail("Couldn't add the section. Please try again.") : done(`Added “${f.row.name}”.`);
}

function itemFields(fd: FormData) {
  const name = str(fd, "name");
  const price = cents(str(fd, "price"));
  const unit = z.enum(["per_person", "flat", "per_unit", "per_table"]).safeParse(str(fd, "unit"));
  const extra = cents(str(fd, "extra"));
  const choiceCount = int(str(fd, "choiceCount"));
  const options = str(fd, "options")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (!name) return { error: "Enter a name." } as const;
  if (price === "bad" || extra === "bad" || choiceCount === "bad") return { error: "Check the numbers." } as const;
  if (!unit.success) return { error: "Choose how it's priced." } as const;
  if (choiceCount !== null && (choiceCount < 1 || choiceCount > 10)) {
    return { error: "Sub-choices: 1 to 10." } as const;
  }
  return {
    row: {
      name,
      price_cents: price ?? 0,
      price_unit: unit.data,
      unit_label: str(fd, "unitLabel") || null,
      extra_unit_price_cents: extra,
      extra_unit_label: str(fd, "extraLabel") || null,
      choice_count: choiceCount,
      choice_options: options.length ? options : null,
      choice_from_section: on(fd, "fromSection"),
      included: on(fd, "included"),
      active: on(fd, "active"),
    },
  } as const;
}

export async function updateItem(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const id = z.uuid().safeParse(str(fd, "id"));
  if (!id.success) return fail("Unknown dish.");
  const f = itemFields(fd);
  if ("error" in f) return fail(f.error!);
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").update(f.row).eq("id", id.data);
  return error ? fail("Couldn't save. Please try again.") : done();
}

export async function addItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const sectionId = z.uuid().safeParse(str(fd, "sectionId"));
  if (!sectionId.success) return fail("Unknown section.");
  fd.set("active", "on");
  const f = itemFields(fd);
  if ("error" in f) return fail(f.error!);
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("menu_items")
    .select("sort_order")
    .eq("section_id", sectionId.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("menu_items")
    .insert({ ...f.row, section_id: sectionId.data, org_id: me.orgId, sort_order: (last?.sort_order ?? 0) + 1 });
  return error ? fail("Couldn't add the dish. Please try again.") : done(`Added “${f.row.name}”.`);
}
