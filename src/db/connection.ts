/**
 * Database access points.
 *
 * - `supabase`  → browser/RLS client (safe anywhere)
 * - `getAdminClient()` → service-role client, server-only, loaded lazily so it
 *   never reaches a client bundle. Use only after the caller is verified.
 */
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type DB = SupabaseClient<Database>;
export { supabase };

export async function getAdminClient(): Promise<DB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as DB;
}
