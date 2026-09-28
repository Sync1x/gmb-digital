import type { PublishTarget } from "@/lib/types";

/**
 * PUBLISH_MODE is the master switch. Only PUBLISH_MODE=live allows posts to
 * go live (and Facebook to fire). Anything else, including unset, means every
 * publish is forced to a WordPress draft: keep it that way locally.
 */
export function isLiveEnabled(): boolean {
  return process.env.PUBLISH_MODE?.trim().toLowerCase() === "live";
}

/** What a requested publish is allowed to become under the master switch. */
export function allowedTarget(requested: PublishTarget): PublishTarget {
  return requested === "live" && isLiveEnabled() ? "live" : "draft";
}

/**
 * Optional safety net while testing: when live publishing is off and
 * MAINWP_TEST_SITE_ID is set, every station's post goes to this one MainWP
 * site instead of the station's own. Ignored when PUBLISH_MODE=live.
 */
export function getTestSiteId(): string | null {
  if (isLiveEnabled()) return null;
  return process.env.MAINWP_TEST_SITE_ID?.trim() || null;
}
