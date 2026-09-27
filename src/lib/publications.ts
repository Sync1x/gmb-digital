import type { Publication } from "@/lib/types";

/**
 * A station is done when WordPress accepted the post and, in live mode, its
 * Facebook webhook fired. In draft mode the webhook is skipped on purpose.
 */
export function isPublicationComplete(p: Publication): boolean {
  return (
    p.status === "published" &&
    !p.error &&
    (p.publish_mode === "draft" || p.facebook_triggered_at !== null)
  );
}

/** What's still missing before a draft can be published. Empty = ready. */
export function getPublishProblems(input: {
  title: string | null | undefined;
  body: string | null | undefined;
  featuredImageUrl: string | null | undefined;
  stations: string[];
}): string[] {
  const problems: string[] = [];
  if (!input.title?.trim()) problems.push("a title");
  if (!input.body?.trim()) problems.push("a body");
  if (!input.featuredImageUrl) problems.push("an image");
  if (input.stations.length === 0) problems.push("at least one station");
  return problems;
}
