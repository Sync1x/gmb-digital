"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { publishDraftToStation } from "@/lib/publish";
import { getPublishProblems, isPublicationComplete } from "@/lib/publications";
import type { ActionResult } from "@/lib/action-result";
import type { Draft, Publication } from "@/lib/types";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Publishes a draft to ONE station. The browser calls this once per station,
 * one after another, so each call stays short and progress shows live.
 */
export async function publishStationAction(
  draftId: string,
  stationSlug: string
): Promise<ActionResult<Publication>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("drafts").select("*").eq("id", draftId).single();
    if (error || !data) throw new Error(error?.message ?? "Draft not found.");
    const draft = data as Draft;

    if (draft.status === "discarded") throw new Error("This draft was discarded.");
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

    const publication = await publishDraftToStation(supabase, draft, stationSlug);
    return { ok: true, data: publication };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** After a publish run: mark the draft published once every station is done. */
export async function finalizeDraftAction(
  draftId: string
): Promise<ActionResult<{ published: boolean }>> {
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
        return p ? isPublicationComplete(p) : false;
      });

    if (allDone && d.status !== "published") {
      const { error } = await supabase
        .from("drafts")
        .update({ status: "published" })
        .eq("id", draftId);
      if (error) throw new Error(error.message);
    }

    revalidatePath("/", "layout");
    return { ok: true, data: { published: allDone } };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}
