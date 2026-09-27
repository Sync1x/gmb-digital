"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { stations } from "@/config/stations";
import type { ActionResult } from "@/lib/action-result";
import type { DraftStatus } from "@/lib/types";

type DraftUpdate = {
  title?: string | null;
  body?: string;
  stations?: string[];
  status?: DraftStatus;
};

const VALID_SLUGS = new Set(stations.map((s) => s.slug));

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function updateDraft(id: string, updates: DraftUpdate): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const clean = {
      ...updates,
      ...(updates.stations ? { stations: updates.stations.filter((s) => VALID_SLUGS.has(s)) } : {}),
    };
    const { error } = await supabase.from("drafts").update(clean).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function setDraftStatus(id: string, status: DraftStatus) {
  return updateDraft(id, { status });
}

/** Creates (or, with an id, updates) a draft from the /new composer. */
export async function saveManualDraft(input: {
  id: string | null;
  title: string;
  body: string;
  sender: string;
  stations: string[];
  featuredImageUrl: string | null;
  status: DraftStatus;
}): Promise<ActionResult<string>> {
  try {
    const { supabase, user } = await requireUser();
    if (!input.body.trim()) throw new Error("Add the story text first.");

    const row = {
      title: input.title.trim() || null,
      body: input.body,
      stations: input.stations.filter((s) => VALID_SLUGS.has(s)),
      featured_image_url: input.featuredImageUrl,
      status: input.status,
      source_type: "manual" as const,
      source_sender: input.sender.trim() || "Messenger",
      source_ref: `Entered by ${user.email}`,
    };

    const query = input.id
      ? supabase.from("drafts").update(row).eq("id", input.id).select("id").single()
      : supabase.from("drafts").insert(row).select("id").single();
    const { data, error } = await query;
    if (error || !data) throw new Error(error?.message ?? "Couldn't save the draft.");

    revalidatePath("/", "layout");
    return { ok: true, data: data.id as string };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}
