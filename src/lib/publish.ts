import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStationBySlug, isConfigured, type Station } from "@/config/stations";
import { createPost, editPost } from "@/lib/mainwp";
import { getTestSiteId } from "@/lib/publish-mode";
import { isDoneFor } from "@/lib/publications";
import { textToHtml } from "@/lib/text-to-html";
import { categorySlugsForStation } from "@/lib/wordpress";
import type { Draft, Publication, PublishTarget } from "@/lib/types";

/** A "pending" row younger than this is treated as a publish already in flight. */
const IN_FLIGHT_MS = 2 * 60 * 1000;

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function saveRow(
  supabase: SupabaseClient,
  draftId: string,
  stationSlug: string,
  fields: Partial<Publication>
): Promise<Publication> {
  const { data, error } = await supabase
    .from("publications")
    .upsert(
      { draft_id: draftId, station_slug: stationSlug, ...fields },
      { onConflict: "draft_id,station_slug" }
    )
    .select()
    .single();
  if (error) throw new Error(`Couldn't record the publish result: ${error.message}`);
  return data as Publication;
}

async function triggerFacebook(
  station: Station,
  pub: Publication,
  title: string
): Promise<string | null> {
  const webhookUrl = process.env[station.makeWebhookEnvVar]?.trim();
  if (!webhookUrl) {
    return `The post is live, but no Facebook webhook is set for ${station.name} (${station.makeWebhookEnvVar}).`;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: pub.wp_post_id,
        post_url: pub.post_url,
        title,
        station: station.slug,
        station_name: station.name,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return `The post is live, but the Facebook webhook failed (HTTP ${res.status}).`;
    }
    return null;
  } catch (err) {
    return `The post is live, but the Facebook webhook failed: ${message(err)}`;
  }
}

/**
 * Sends one draft to one station, as a WordPress draft or live. Safe to call
 * again as a retry, and to call with "live" after a "draft" run:
 * - no post yet on this site: create it
 * - a WordPress draft already exists: update it in place (content,
 *   categories, and status, so approving it publishes that same post)
 * - already live: leave WordPress alone and only retry Facebook
 *
 * Order matters: the Facebook webhook fires only after MainWP confirmed the
 * post is live for this station, and never for a WordPress draft.
 */
export async function publishDraftToStation(
  supabase: SupabaseClient,
  draft: Draft,
  stationSlug: string,
  target: PublishTarget
): Promise<Publication> {
  const station = getStationBySlug(stationSlug);
  if (!station) throw new Error(`Unknown station "${stationSlug}".`);

  const title = draft.title?.trim() ?? "";

  const { data: existingRow } = await supabase
    .from("publications")
    .select("*")
    .eq("draft_id", draft.id)
    .eq("station_slug", stationSlug)
    .maybeSingle();
  const existing = existingRow as Publication | null;

  if (
    existing?.status === "pending" &&
    Date.now() - new Date(existing.updated_at).getTime() < IN_FLIGHT_MS
  ) {
    throw new Error(`${station.name} is already being published. Wait a moment and refresh.`);
  }

  const siteId = getTestSiteId() ?? station.mainwpSiteId;
  if (!isConfigured(siteId)) {
    return saveRow(supabase, draft.id, stationSlug, {
      status: "failed",
      mainwp_site_id: null,
      publish_mode: "draft",
      error: `${station.name} has no MainWP site ID yet. Set it in src/config/stations.ts (see Settings).`,
    });
  }

  // A post made on another site (e.g. the test site) is never reused.
  const existingPostId =
    existing?.wp_post_id && existing.mainwp_site_id === siteId ? existing.wp_post_id : null;
  const alreadyLive = existingPostId && existing?.publish_mode === "live";

  let pub: Publication;

  if (existing && alreadyLive) {
    pub = existing;
  } else {
    await saveRow(supabase, draft.id, stationSlug, {
      status: "pending",
      mainwp_site_id: siteId,
      wp_post_id: existingPostId,
      error: null,
      ...(existingPostId ? {} : { post_url: null, publish_mode: "draft", facebook_triggered_at: null }),
    });

    try {
      let categories: string[];
      try {
        categories = await categorySlugsForStation(station, draft.categories ?? []);
      } catch (err) {
        throw new Error(`Couldn't read ${station.name}'s categories: ${message(err)}`);
      }
      const post = {
        siteId,
        title,
        content: textToHtml(draft.body),
        status: target === "live" ? ("publish" as const) : ("draft" as const),
        categories,
        allowComments: draft.allow_comments === true,
      };

      if (existingPostId) {
        await editPost({ ...post, postId: existingPostId });
        pub = await saveRow(supabase, draft.id, stationSlug, {
          status: "published",
          publish_mode: target,
          error: null,
        });
      } else {
        const created = await createPost({
          ...post,
          featuredImageUrl: draft.featured_image_url ?? undefined,
        });
        pub = await saveRow(supabase, draft.id, stationSlug, {
          status: "published",
          publish_mode: target,
          wp_post_id: created.postId,
          post_url: created.postUrl,
          error: null,
        });
      }
    } catch (err) {
      // Keep any existing post id so a retry updates that post instead of
      // creating a duplicate.
      return saveRow(supabase, draft.id, stationSlug, {
        status: "failed",
        error: message(err),
      });
    }
  }

  // WordPress confirmed the post is live. Facebook only then, and only once.
  if (pub.publish_mode === "live" && !pub.facebook_triggered_at) {
    const fbError = await triggerFacebook(station, pub, title);
    pub = await saveRow(supabase, draft.id, stationSlug, {
      error: fbError,
      facebook_triggered_at: fbError ? null : new Date().toISOString(),
    });
  } else if (pub.error) {
    pub = await saveRow(supabase, draft.id, stationSlug, { error: null });
  }

  return pub;
}

/**
 * After a run: once every station is done, a live run marks the draft
 * published; a WordPress-draft run marks it ready (waiting for approval).
 * Shared by the browser flow and the scheduler, so both end the same way.
 */
export async function finalizeDraft(
  supabase: SupabaseClient,
  draftId: string,
  target: PublishTarget
): Promise<{ done: boolean }> {
  const [{ data: draft, error: draftError }, { data: pubs, error: pubError }] = await Promise.all([
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
    // Only from the states a publish run starts in ("publishing" is the
    // scheduler's), so a draft scheduled or discarded meanwhile isn't flipped.
    const { error } = await supabase
      .from("drafts")
      .update({
        status: nextStatus,
        scheduled_for: null,
        publish_attempts: 0,
        last_publish_error: null,
        publishing_started_at: null,
        edited_after_scheduling: false,
      })
      .eq("id", draftId)
      .in("status", ["new", "ready", "publishing"]);
    if (error) throw new Error(error.message);
  }
  return { done: allDone };
}
