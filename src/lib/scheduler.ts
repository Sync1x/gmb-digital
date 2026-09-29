import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStationBySlug } from "@/config/stations";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeDraft, publishDraftToStation } from "@/lib/publish";
import { getPublishProblems, isDoneFor } from "@/lib/publications";
import { allowedTarget } from "@/lib/publish-mode";
import type { Draft, PublishTarget } from "@/lib/types";

/** Failed attempts before a draft is marked "failed" and retries stop. */
export const MAX_ATTEMPTS = 3;
/** How long to wait before retrying a failed attempt. */
const RETRY_DELAY_MS = 5 * 60 * 1000;
/** Due longer than this ago when the run picks it up = "late" (still published). */
const LATE_AFTER_MS = 15 * 60 * 1000;

export type RunSource = "cron" | "manual";

export type RunSummary = {
  claimed: number;
  published: number;
  failed: number;
  late: number;
  /** Drafts that were stuck in "publishing" and put back on the schedule first. */
  recovered: number;
  /** "live" = posts went public; "draft" = PUBLISH_MODE is off, so only WordPress drafts were saved. */
  mode: PublishTarget;
};

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Outcome = { ok: true } | { ok: false; error: string; permanent?: boolean };

/**
 * Publishes one claimed draft through the same per-station code the browser
 * uses (MainWP post + featured image, Facebook webhook only after WordPress
 * confirms), then finalizes it the same way.
 */
async function publishClaimed(
  supabase: SupabaseClient,
  draft: Draft,
  target: PublishTarget
): Promise<Outcome> {
  const problems = getPublishProblems({
    title: draft.title,
    body: draft.body,
    featuredImageUrl: draft.featured_image_url,
    stations: draft.stations,
  });
  if (problems.length) {
    // Retrying can't fix a missing title or image.
    return { ok: false, permanent: true, error: `Missing ${problems.join(", ")}.` };
  }

  const errors: string[] = [];
  // One station at a time, like the browser flow: a failure never blocks the rest.
  for (const slug of draft.stations) {
    const name = getStationBySlug(slug)?.name ?? slug;
    try {
      const pub = await publishDraftToStation(supabase, draft, slug, target);
      if (!isDoneFor(pub, target)) errors.push(`${name}: ${pub.error ?? "didn't finish"}`);
    } catch (err) {
      errors.push(`${name}: ${message(err)}`);
    }
  }
  if (errors.length) return { ok: false, error: errors.join(" · ") };

  const { done } = await finalizeDraft(supabase, draft.id, target);
  return done ? { ok: true } : { ok: false, error: "Not every station finished." };
}

/**
 * Records a failed attempt. Under the limit the draft goes back to
 * "scheduled" for 5 minutes later; at the limit it becomes "failed". Only
 * touches the row while it's still "publishing", so a draft someone unscheduled
 * or discarded meanwhile is left alone.
 */
async function recordFailure(
  supabase: SupabaseClient,
  draft: Draft,
  error: string,
  permanent: boolean
) {
  const attempts = draft.publish_attempts + 1;
  const giveUp = permanent || attempts >= MAX_ATTEMPTS;
  const { error: dbError } = await supabase
    .from("drafts")
    .update({
      status: giveUp ? "failed" : "scheduled",
      publish_attempts: attempts,
      last_publish_error: error.slice(0, 1000),
      publishing_started_at: null,
      ...(giveUp ? {} : { scheduled_for: new Date(Date.now() + RETRY_DELAY_MS).toISOString() }),
    })
    .eq("id", draft.id)
    .eq("status", "publishing");
  if (dbError) console.error(`[scheduler] couldn't record failure for ${draft.id}: ${dbError.message}`);
  console.warn(
    `[scheduler] draft ${draft.id} attempt ${attempts}/${MAX_ATTEMPTS} failed${giveUp ? " (giving up)" : ""}: ${error}`
  );
}

/**
 * One scheduler pass: put stuck drafts back, atomically claim everything that
 * is due, publish what was claimed, log the run. Safe to call from two places
 * at once, because a draft can only be claimed once.
 */
export async function runDueDrafts(source: RunSource): Promise<RunSummary> {
  const supabase = createAdminClient();
  const target = allowedTarget("live");

  const { data: recovered, error: recoverError } = await supabase.rpc("recover_stuck_drafts");
  if (recoverError) throw new Error(`Couldn't check for stuck drafts: ${recoverError.message}`);

  // One UPDATE ... RETURNING in the database (see migration 0006).
  const { data: claimedRows, error: claimError } = await supabase.rpc("claim_due_drafts");
  if (claimError) throw new Error(`Couldn't claim due drafts: ${claimError.message}`);
  const claimed = (claimedRows ?? []) as Draft[];

  const claimedAt = Date.now();
  const lateIds = new Set(
    claimed
      .filter(
        (d) => d.scheduled_for && claimedAt - new Date(d.scheduled_for).getTime() > LATE_AFTER_MS
      )
      .map((d) => d.id)
  );
  for (const d of claimed) {
    if (lateIds.has(d.id)) {
      const mins = Math.round((claimedAt - new Date(d.scheduled_for!).getTime()) / 60_000);
      console.warn(`[scheduler] LATE: draft ${d.id} was due ${mins} minutes ago; publishing anyway.`);
    }
  }

  // Drafts are independent, so they run side by side (stations stay sequential).
  const outcomes = await Promise.all(
    claimed.map(async (draft): Promise<Outcome> => {
      try {
        const outcome = await publishClaimed(supabase, draft, target);
        if (!outcome.ok) {
          await recordFailure(supabase, draft, outcome.error, outcome.permanent ?? false);
        }
        return outcome;
      } catch (err) {
        await recordFailure(supabase, draft, message(err), false);
        return { ok: false, error: message(err) };
      }
    })
  );

  const summary: RunSummary = {
    claimed: claimed.length,
    published: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).length,
    late: lateIds.size,
    recovered: (recovered as number | null) ?? 0,
    mode: target,
  };

  const { error: logError } = await supabase.rpc("record_scheduler_run", {
    p_source: source,
    p_publish_mode: target,
    p_claimed: summary.claimed,
    p_published: summary.published,
    p_failed: summary.failed,
    p_late: summary.late,
  });
  if (logError) console.error(`[scheduler] couldn't log the run: ${logError.message}`);

  return summary;
}
