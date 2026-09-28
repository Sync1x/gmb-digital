import type { Publication, PublishTarget } from "@/lib/types";

/**
 * A station is done when WordPress accepted the post and, if it's live, its
 * Facebook webhook fired. WordPress drafts skip Facebook on purpose.
 */
export function isPublicationComplete(p: Publication): boolean {
  return (
    p.status === "published" &&
    !p.error &&
    (p.publish_mode === "draft" || p.facebook_triggered_at !== null)
  );
}

/** Done for this run: a "live" run also needs the post to actually be live. */
export function isDoneFor(p: Publication, target: PublishTarget): boolean {
  return isPublicationComplete(p) && (target === "draft" || p.publish_mode === "live");
}

/** True when this station already has a WordPress draft waiting for approval. */
export function isWordpressDraft(p: Publication): boolean {
  return p.status === "published" && p.publish_mode === "draft";
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
