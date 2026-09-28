export type SourceType = "newsletter" | "manual";
export type DraftStatus = "new" | "ready" | "published" | "discarded";

export type Draft = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  body: string;
  source_type: SourceType;
  source_sender: string | null;
  source_ref: string | null;
  stations: string[];
  /** WordPress category names; each station gets the ones its site has. */
  categories: string[];
  status: DraftStatus;
  featured_image_url: string | null;
};

export type PublicationStatus = "pending" | "published" | "failed";

export type Publication = {
  id: string;
  draft_id: string;
  station_slug: string;
  mainwp_site_id: string | null;
  wp_post_id: string | null;
  post_url: string | null;
  status: PublicationStatus;
  error: string | null;
  facebook_triggered_at: string | null;
  /** How the WordPress post currently stands: "draft" or "live" (published). */
  publish_mode: PublishTarget;
  created_at: string;
  updated_at: string;
};

/** Where a publish run sends posts: WordPress drafts, or live (+ Facebook). */
export type PublishTarget = "draft" | "live";

/** Server-computed values passed down to client components. */
export type DraftCardContext = {
  aiEnabled: boolean;
  /** False when PUBLISH_MODE isn't "live": only WordPress drafts are allowed. */
  liveEnabled: boolean;
  /** Category names per station slug; null = that site couldn't be read. */
  categoriesByStation: Record<string, string[] | null>;
};
