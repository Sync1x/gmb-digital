"use server";

import { requireUser } from "@/lib/auth";
import { suggestTitles } from "@/lib/ai";
import type { ActionResult } from "@/lib/action-result";

export async function suggestTitlesAction(
  body: string,
  currentTitle: string | null
): Promise<ActionResult<string[]>> {
  try {
    await requireUser();
    return { ok: true, data: await suggestTitles(body, currentTitle) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
