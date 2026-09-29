import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueDrafts } from "@/lib/scheduler";

// A run can publish several drafts to up to six sites each.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Only `Authorization: Bearer <CRON_SECRET>` gets in. Compared in constant time. */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[scheduler] CRON_SECRET isn't set, so every cron call is rejected.");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  return timingSafeEqual(sha256(match[1]), sha256(secret));
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDueDrafts("cron"));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] run failed: ${error}`);
    return NextResponse.json({ error }, { status: 500 });
  }
}

/** Supabase's pg_cron job POSTs here. */
export const POST = handle;
/** Vercel Cron always sends GET (with the same bearer header), so it's accepted too. */
export const GET = handle;
