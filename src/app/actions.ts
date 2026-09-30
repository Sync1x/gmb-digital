"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { stations } from "@/config/stations";
import type { ActionResult } from "@/lib/action-result";
import type { Draft } from "@/lib/types";

type DraftUpdate = {
  title?: string | null;
  body?: string;
  stations?: string[];
  categories?: string[];
  allow_comments?: boolean;
  /** Only manual states: scheduling goes through schedule-actions.ts. */
  status?: "new" | "ready" | "discarded";
};

function cleanCategories(names: string[]): string[] {
  // Commas would split a name in MainWP's comma-separated category string.
  return [...new Set(names.map((n) => n.trim()).filter((n) => n && !n.includes(",")))];
}

const VALID_SLUGS = new Set(stations.map((s) => s.slug));

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function updateDraft(id: string, updates: DraftUpdate): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const clean: Record<string, unknown> = {
      ...updates,
      ...(updates.stations ? { stations: updates.stations.filter((s) => VALID_SLUGS.has(s)) } : {}),
      ...(updates.categories ? { categories: cleanCategories(updates.categories) } : {}),
    };

    // The scheduler owns a draft while it publishes it: hands off.
    const { data: current } = await supabase
      .from("drafts")
      .select("status, title, body, stations, categories")
      .eq("id", id)
      .single();
    const before = current as Pick<
      Draft,
      "status" | "title" | "body" | "stations" | "categories"
    > | null;
    if (before?.status === "publishing") {
      throw new Error("This draft is being published right now. Try again in a minute.");
    }

    // Editing a scheduled draft keeps it scheduled, but the card notes the change.
    if (before?.status === "scheduled" && updates.status === "discarded") {
      Object.assign(clean, { scheduled_for: null, edited_after_scheduling: false });
    } else if (before?.status === "scheduled") {
      const changed =
        (clean.title !== undefined && clean.title !== before.title) ||
        (clean.body !== undefined && clean.body !== before.body) ||
        (clean.stations !== undefined && !sameList(clean.stations as string[], before.stations)) ||
        (clean.categories !== undefined &&
          !sameList(clean.categories as string[], before.categories ?? []));
      if (changed) clean.edited_after_scheduling = true;
    }

    const { error } = await supabase.from("drafts").update(clean).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function setDraftStatus(id: string, status: "new" | "ready" | "discarded") {
  return updateDraft(id, { status });
}

/** Creates (or, with an id, updates) a draft from the /new composer. */
export async function saveManualDraft(input: {
  id: string | null;
  title: string;
  body: string;
  sender: string;
  stations: string[];
  categories: string[];
  /** Sent only once the toggle was touched, so saves work before migration 0008. */
  allowComments?: boolean;
  featuredImageUrl: string | null;
  status: "new" | "ready";
}): Promise<ActionResult<string>> {
  try {
    const { supabase, user } = await requireUser();
    if (!input.body.trim()) throw new Error("Add the story text first.");

    const row = {
      title: input.title.trim() || null,
      body: input.body,
      stations: input.stations.filter((s) => VALID_SLUGS.has(s)),
      categories: cleanCategories(input.categories),
      ...(input.allowComments === undefined ? {} : { allow_comments: input.allowComments }),
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
