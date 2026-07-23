import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Build a service-role Supabase client for a fetcher.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) +
 * SUPABASE_SERVICE_ROLE_KEY from the environment. Fails loudly if
 * either is missing — we never want a fetcher to silently no-op
 * because it couldn't authenticate.
 */
export function createFetcherSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — a fetcher cannot start without them.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-weelake-caller": "fetcher" } },
  });
}
