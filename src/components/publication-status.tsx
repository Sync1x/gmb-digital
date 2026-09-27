"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ExternalLinkIcon, RotateCwIcon, XIcon } from "lucide-react";
import { finalizeDraftAction, publishStationAction } from "@/app/publish-actions";
import { getStationBySlug } from "@/config/stations";
import { isPublicationComplete } from "@/lib/publications";
import type { Publication } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type StationRunState =
  | { state: "waiting" }
  | { state: "running" }
  | { state: "done"; publication: Publication }
  | { state: "error"; error: string };

/** One station's row: status, link to the post, Facebook state, error and Retry. */
export function StationResultRow({
  slug,
  run,
  onRetry,
  retrying,
}: {
  slug: string;
  run: StationRunState;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const name = getStationBySlug(slug)?.name ?? slug;
  const pub = run.state === "done" ? run.publication : null;
  const complete = pub ? isPublicationComplete(pub) : false;
  const failed = run.state === "error" || (pub !== null && !complete && pub.status !== "pending");
  const error = run.state === "error" ? run.error : pub?.error;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          {run.state === "running" || pub?.status === "pending" ? (
            <Spinner />
          ) : complete ? (
            <CheckIcon className="size-4 text-green-600" />
          ) : failed ? (
            <XIcon className="size-4 text-destructive" />
          ) : (
            <span className="size-4" />
          )}
          {name}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {run.state === "waiting" && <span className="text-sm text-muted-foreground">Waiting</span>}
          {run.state === "running" && <span className="text-sm text-muted-foreground">Posting…</span>}
          {pub?.status === "published" && (
            <>
              <Badge variant="secondary">
                {pub.publish_mode === "draft" ? "WordPress draft" : "Live"}
              </Badge>
              {pub.publish_mode === "live" && (
                <Badge variant={pub.facebook_triggered_at ? "secondary" : "outline"}>
                  Facebook: {pub.facebook_triggered_at ? "sent" : "not sent"}
                </Badge>
              )}
              {pub.post_url && (
                <a
                  href={pub.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                >
                  View post <ExternalLinkIcon className="size-3.5" />
                </a>
              )}
            </>
          )}
          {failed && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
              {retrying ? <Spinner /> : <RotateCwIcon />}
              Retry
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Saved publish results on a draft card, with Retry for failed stations. */
export function PublicationStatus({
  draftId,
  publications,
}: {
  draftId: string;
  publications: Publication[];
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);

  async function retry(slug: string) {
    setRetrying(slug);
    const result = await publishStationAction(draftId, slug);
    if (result.ok && isPublicationComplete(result.data)) {
      toast.success(`${getStationBySlug(slug)?.name ?? slug}: done`);
    } else {
      toast.error(result.ok ? (result.data.error ?? "Still failing") : result.error);
    }
    const fin = await finalizeDraftAction(draftId);
    if (fin.ok && fin.data.published) toast.success("All stations done: draft marked published");
    setRetrying(null);
    router.refresh();
  }

  if (publications.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">Publish results</span>
      {publications
        .slice()
        .sort((a, b) => a.station_slug.localeCompare(b.station_slug))
        .map((pub) => (
          <StationResultRow
            key={pub.id}
            slug={pub.station_slug}
            run={{ state: "done", publication: pub }}
            onRetry={() => retry(pub.station_slug)}
            retrying={retrying === pub.station_slug}
          />
        ))}
    </div>
  );
}
