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
  publish_mode: "draft" | "live";
  created_at: string;
  updated_at: string;
};

/** Server-computed flags passed down to client components. */
export type DraftCardContext = {
  aiEnabled: boolean;
  publishMode: "draft" | "live";
};
