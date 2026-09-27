"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { listSites } from "@/lib/mainwp";

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
