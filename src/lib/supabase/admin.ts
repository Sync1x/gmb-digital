import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client using the SECRET service-role key. Server-side only —
 * never import this from a Client Component or expose the key to the
 * browser. Bypasses RLS, so every caller of this file is responsible for
 * its own authorization checks (e.g. the x-intake-secret header check in
 * /api/intake).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars"
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
