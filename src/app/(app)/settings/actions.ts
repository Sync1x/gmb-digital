"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { listSites } from "@/lib/mainwp";
import { runDueDrafts, type RunSummary } from "@/lib/scheduler";
import type { ActionResult } from "@/lib/action-result";

export type ConnectionResult =
  | { ok: true; siteCount: number }
  | { ok: false; error: string };

export async function testMainwpConnection(): Promise<ConnectionResult> {
  await requireUser();
  try {
    const sites = await listSites();
    revalidatePath("/settings");
    return { ok: true, siteCount: sites.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * "Run now" on Settings: one scheduler pass, same code the cron job runs. It
 * publishes anything that is due, so it respects PUBLISH_MODE like the job does.
 */
export async function runSchedulerNow(): Promise<ActionResult<RunSummary>> {
  try {
    await requireUser();
    const summary = await runDueDrafts("manual");
    revalidatePath("/", "layout");
    return { ok: true, data: summary };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
