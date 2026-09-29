"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getPublishProblems } from "@/lib/publications";
import { checkScheduleTime } from "@/lib/schedule-time";
import type { ActionResult } from "@/lib/action-result";
import type { Draft } from "@/lib/types";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/** Statuses a draft can be scheduled from. "publishing" is the runner's; never touch it. */
const SCHEDULABLE = ["new", "ready", "scheduled", "failed"];

/**
 * Schedules a draft (or moves an existing schedule). Same readiness rules as
 * publishing, and the time must be at least 5 minutes out. The browser saves
 * the card's edits first, so the row read here is what will go out.
 */
export async function scheduleDraftAction(
  draftId: string,
  scheduledForIso: string
): Promise<ActionResult<{ scheduledFor: string }>> {
  try {
    const { supabase } = await requireUser();

    const when = new Date(scheduledForIso);
    const timeProblem = checkScheduleTime(when);
    if (timeProblem) throw new Error(timeProblem);

    const { data, error } = await supabase.from("drafts").select("*").eq("id", draftId).single();
    if (error || !data) throw new Error(error?.message ?? "Draft not found.");
    const draft = data as Draft;

    if (!SCHEDULABLE.includes(draft.status)) {
      throw new Error(
        draft.status === "publishing"
          ? "This draft is being published right now."
          : `A ${draft.status} draft can't be scheduled.`
      );
    }
    const problems = getPublishProblems({
      title: draft.title,
      body: draft.body,
      featuredImageUrl: draft.featured_image_url,
      stations: draft.stations,
    });
    if (problems.length) throw new Error(`Add ${problems.join(", ")} before scheduling.`);

    // Conditional on status so a draft the runner just claimed isn't touched.
    const { data: updated, error: updateError } = await supabase
      .from("drafts")
      .update({
        status: "scheduled",
        scheduled_for: when.toISOString(),
        publish_attempts: 0,
        last_publish_error: null,
        publishing_started_at: null,
        edited_after_scheduling: false,
      })
      .eq("id", draftId)
      .in("status", SCHEDULABLE)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (!updated?.length) throw new Error("This draft is being published right now.");

    revalidatePath("/", "layout");
    return { ok: true, data: { scheduledFor: when.toISOString() } };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/**
 * Takes a draft off the schedule (or out of the failed state) and puts it back
 * to "ready". Also the first step of Publish now / Retry now, so the runner can
 * never pick the draft up while it's being published by hand. Fails if the
 * runner already claimed it.
 */
export async function unscheduleDraftAction(draftId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const { data: updated, error } = await supabase
      .from("drafts")
      .update({
        status: "ready",
        scheduled_for: null,
        publish_attempts: 0,
        last_publish_error: null,
        publishing_started_at: null,
        edited_after_scheduling: false,
      })
      .eq("id", draftId)
      .in("status", ["scheduled", "failed"])
      .select("id");
    if (error) throw new Error(error.message);

    if (!updated?.length) {
      const { data: current } = await supabase
        .from("drafts")
        .select("status")
        .eq("id", draftId)
        .single();
      const status = current?.status as string | undefined;
      if (status === "publishing") throw new Error("It's being published right now.");
      if (status === "published") throw new Error("It has already been published.");
      if (status === "discarded") throw new Error("This draft was discarded.");
      if (!status) throw new Error("Draft not found.");
      // new / ready: nothing to undo.
    }

    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}
