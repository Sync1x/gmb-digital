export type PublishMode = "draft" | "live";

/**
 * PUBLISH_MODE=live is the only way to publish for real. Anything else,
 * including unset, means "draft": WordPress posts are created as drafts and
 * Make.com Facebook webhooks are skipped.
 */
export function getPublishMode(): PublishMode {
  return process.env.PUBLISH_MODE?.trim().toLowerCase() === "live" ? "live" : "draft";
}

/**
 * Optional safety net while testing: in draft mode, if MAINWP_TEST_SITE_ID is
 * set, every station's post is sent to this one MainWP site instead of the
 * station's own site. Ignored in live mode.
 */
export function getTestSiteId(): string | null {
  if (getPublishMode() === "live") return null;
  return process.env.MAINWP_TEST_SITE_ID?.trim() || null;
}
