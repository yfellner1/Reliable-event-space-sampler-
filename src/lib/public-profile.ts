import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicProfile = { name: string; tagline: string | null; brandColor: string | null };

const FALLBACK: PublicProfile = { name: "Event bookings", tagline: null, brandColor: null };

/**
 * The business's name, tagline, and color for screens shown before sign-in
 * (the sign-in page). Each deployment serves one business: the one named by
 * BOOTSTRAP_ORG_SLUG, or the first one set up.
 */
export const publicProfile = cache(async (): Promise<PublicProfile> => {
  try {
    const db = createAdminClient();
    let query = db.from("organizations").select("name, tagline, brand_color").order("created_at").limit(1);
    if (process.env.BOOTSTRAP_ORG_SLUG) query = query.eq("slug", process.env.BOOTSTRAP_ORG_SLUG);
    const { data } = await query.maybeSingle();
    return data ? { name: data.name, tagline: data.tagline, brandColor: data.brand_color } : FALLBACK;
  } catch {
    return FALLBACK;
  }
});
