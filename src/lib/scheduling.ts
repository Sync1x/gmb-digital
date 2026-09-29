import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The image changes on a draft's own row (not through Save), so a scheduled
 * draft that gets a new image must be flagged here too. No-op for any other
 * status.
 */
export async function markEditedIfScheduled(supabase: SupabaseClient, draftId: string) {
  await supabase
    .from("drafts")
    .update({ edited_after_scheduling: true })
    .eq("id", draftId)
    .eq("status", "scheduled");
}
