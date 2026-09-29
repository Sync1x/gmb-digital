"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { publishDraftToStation } from "@/lib/publish";
import { allowedTarget } from "@/lib/publish-mode";
import { getPublishProblems, isDoneFor } from "@/lib/publications";
import type { ActionResult } from "@/lib/action-result";
import type { Draft, Publication, PublishTarget } from "@/lib/types";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function checkTarget(target: PublishTarget) {
  if (allowedTarget(target) !== target) {
    throw new Error(
      "Live publishing is off (PUBLISH_MODE isn't \"live\"). Send it as a WordPress draft instead."
    );
  }
}

/**
 * Sends a draft to ONE station, as a WordPress draft or live. The browser
 * calls this once per station, one after another, so each call stays short
 * and progress shows live.
 */
export async function publishStationAction(
  draftId: string,
  stationSlug: string,
  target: PublishTarget
): Promise<ActionResult<Publication>> {
  try {
    checkTarget(target);
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("drafts").select("*").eq("id", draftId).single();
    if (error || !data) throw new Error(error?.message ?? "Draft not found.");
    const draft = data as Draft;

    if (draft.status === "discarded") throw new Error("This draft was discarded.");
    if (draft.status === "publishing") {
      throw new Error("The scheduler is publishing this draft right now.");
    }
    if (draft.status === "scheduled") {
      throw new Error("This draft is scheduled. Unschedule it or use Publish now.");
    }
    const problems = getPublishProblems({
      title: draft.title,
      body: draft.body,
      featuredImageUrl: draft.featured_image_url,
      stations: draft.stations,
    });
    if (problems.length) throw new Error(`Add ${problems.join(", ")} before publishing.`);
    if (!draft.stations.includes(stationSlug)) {
      throw new Error("That station isn't ticked on this draft. Save the draft first.");
    }

    const publication = await publishDraftToStation(supabase, draft, stationSlug, target);
    return { ok: true, data: publication };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/**
 * After a run: once every station is done, a live run marks the draft
 * published; a WordPress-draft run marks it ready (waiting for approval).
 */
export async function finalizeDraftAction(
  draftId: string,
  target: PublishTarget
): Promise<ActionResult<{ done: boolean }>> {
  try {
    const { supabase } = await requireUser();
    const [{ data: draft, error: draftError }, { data: pubs, error: pubError }] =
      await Promise.all([
        supabase.from("drafts").select("*").eq("id", draftId).single(),
        supabase.from("publications").select("*").eq("draft_id", draftId),
      ]);
    if (draftError || !draft) throw new Error(draftError?.message ?? "Draft not found.");
    if (pubError) throw new Error(pubError.message);

    const d = draft as Draft;
    const byStation = new Map((pubs as Publication[]).map((p) => [p.station_slug, p]));
    const allDone =
      d.stations.length > 0 &&
      d.stations.every((slug) => {
        const p = byStation.get(slug);
        return p ? isDoneFor(p, target) : false;
      });

    const nextStatus = target === "live" ? "published" : "ready";
    if (allDone && d.status !== nextStatus && d.status !== "published") {
      const { error } = await supabase
        .from("drafts")
        .update({ status: nextStatus })
        .eq("id", draftId);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/", "layout");
    return { ok: true, data: { done: allDone } };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}
