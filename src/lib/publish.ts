import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStationBySlug, isConfigured, type Station } from "@/config/stations";
import { createPost } from "@/lib/mainwp";
import { getPublishMode, getTestSiteId } from "@/lib/publish-mode";
import { textToHtml } from "@/lib/text-to-html";
import type { Draft, Publication } from "@/lib/types";

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
 * Publishes one draft to one station. Safe to call again as a retry: a
 * station whose WordPress post already exists only re-fires Facebook.
 *
 * Order matters: the Facebook webhook fires only after MainWP confirmed the
 * WordPress post for this station, and never in draft mode.
 */
export async function publishDraftToStation(
  supabase: SupabaseClient,
  draft: Draft,
  stationSlug: string
): Promise<Publication> {
  const station = getStationBySlug(stationSlug);
  if (!station) throw new Error(`Unknown station "${stationSlug}".`);

  const mode = getPublishMode();
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

  // Reuse the WordPress post if it was already created in this same mode
  // (a retry after a Facebook failure). A draft-mode test post is never
  // reused for a live publish.
  const alreadyPosted =
    existing?.status === "published" && existing.wp_post_id && existing.publish_mode === mode;

  let pub: Publication;

  if (alreadyPosted) {
    pub = existing;
  } else {
    const siteId = getTestSiteId() ?? station.mainwpSiteId;
    if (!isConfigured(siteId)) {
      return saveRow(supabase, draft.id, stationSlug, {
        status: "failed",
        mainwp_site_id: null,
        publish_mode: mode,
        error: `${station.name} has no MainWP site ID yet. Set it in src/config/stations.ts (see Settings).`,
      });
    }

    await saveRow(supabase, draft.id, stationSlug, {
      status: "pending",
      mainwp_site_id: siteId,
      publish_mode: mode,
      wp_post_id: null,
      post_url: null,
      error: null,
      facebook_triggered_at: null,
    });

    try {
      const created = await createPost({
        siteId,
        title,
        content: textToHtml(draft.body),
        status: mode === "live" ? "publish" : "draft",
        categories: station.wpCategories,
        featuredImageUrl: draft.featured_image_url ?? undefined,
      });
      pub = await saveRow(supabase, draft.id, stationSlug, {
        status: "published",
        wp_post_id: created.postId,
        post_url: created.postUrl,
        error: null,
      });
    } catch (err) {
      return saveRow(supabase, draft.id, stationSlug, {
        status: "failed",
        error: message(err),
      });
    }
  }

  // WordPress confirmed. Facebook only in live mode, and only once.
  if (mode === "live" && !pub.facebook_triggered_at) {
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
