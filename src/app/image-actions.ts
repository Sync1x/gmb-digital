"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { searchImages, type ImageResult } from "@/lib/image-search";
import { deleteFeaturedImage, downloadImage, storeFeaturedImage } from "@/lib/images";
import { markEditedIfScheduled } from "@/lib/scheduling";
import { getStationMedia, type WpMediaPage } from "@/lib/wordpress";
import { stations } from "@/config/stations";
import type { ActionResult } from "@/lib/action-result";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function searchImagesAction(query: string): Promise<ActionResult<ImageResult[]>> {
  try {
    await requireUser();
    const q = query.trim();
    if (!q) return { ok: false, error: "Type something to search for." };
    return { ok: true, data: await searchImages(q, 8) };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/** One page of a station's WordPress media library, optionally searched. */
export async function listStationMediaAction(
  stationSlug: string,
  query: string,
  page: number
): Promise<ActionResult<WpMediaPage>> {
  try {
    await requireUser();
    const station = stations.find((s) => s.slug === stationSlug);
    if (!station) return { ok: false, error: "Unknown station." };
    return { ok: true, data: await getStationMedia(station, { search: query, page }) };
  } catch (err) {
    return { ok: false, error: `Couldn't load the media library: ${message(err)}` };
  }
}

/**
 * Downloads a picked search result, converts it to JPEG, stores it and (when
 * a draftId is given) saves the URL on the draft.
 */
export async function pickImageAction(
  imageUrl: string,
  draftId: string | null
): Promise<ActionResult<string>> {
  try {
    const { supabase } = await requireUser();
    const buffer = await downloadImage(imageUrl);
    const publicUrl = await storeFeaturedImage(buffer);

    if (draftId) {
      const { error } = await supabase
        .from("drafts")
        .update({ featured_image_url: publicUrl })
        .eq("id", draftId);
      if (error) throw new Error(`Image saved but couldn't update the draft: ${error.message}`);
      await markEditedIfScheduled(supabase, draftId);
      revalidatePath("/");
    }
    return { ok: true, data: publicUrl };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function removeImageAction(
  draftId: string | null,
  imageUrl: string
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    if (draftId) {
      const { error } = await supabase
        .from("drafts")
        .update({ featured_image_url: null })
        .eq("id", draftId);
      if (error) throw new Error(error.message);
      await markEditedIfScheduled(supabase, draftId);
      revalidatePath("/");
    }
    // WordPress keeps its own copy, so removing ours is safe. Best-effort.
    await deleteFeaturedImage(imageUrl).catch(() => {});
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}
