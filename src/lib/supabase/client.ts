import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Browser client, used for live updates (Realtime) in later phases. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
