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
