"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DraftStatus } from "@/lib/types";

type DraftUpdate = {
  title?: string | null;
  body?: string;
  stations?: string[];
  status?: DraftStatus;
};

export async function updateDraft(id: string, updates: DraftUpdate) {
  const supabase = await createClient();
  const { error } = await supabase.from("drafts").update(updates).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function setDraftStatus(id: string, status: DraftStatus) {
  return updateDraft(id, { status });
}
