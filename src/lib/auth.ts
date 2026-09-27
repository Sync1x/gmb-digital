import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/allowed-emails";

/**
 * Server actions and route handlers call this first. The proxy already
 * guards pages, but actions can be POSTed to directly.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isAllowedEmail(user.email)) {
    throw new Error("You're not signed in. Reload the page and sign in again.");
  }

  return { user, supabase };
}
