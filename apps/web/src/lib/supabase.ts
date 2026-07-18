import { createClient } from "@supabase/supabase-js";

/**
 * Browser / anon client — safe to expose.
 * Enforces RLS policies. Read-only for public data.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase browser env vars missing (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "x-application-name": "weelake-web" } },
  });
}

/**
 * Server-side client with service role — bypasses RLS.
 * Use only in server components, route handlers, and workers.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service env vars missing (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "weelake-server" } },
  });
}
