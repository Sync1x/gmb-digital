"use client";

import { useState } from "react";
import { toast } from "sonner";
import { finalizeDraftAction, publishStationAction } from "@/app/publish-actions";
import { getStationBySlug } from "@/config/stations";
import { isPublicationComplete } from "@/lib/publications";
import { StationResultRow, type StationRunState } from "@/components/publication-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  stationSlugs: string[];
  publishMode: "draft" | "live";
  /** Saves current edits and returns the draft id to publish (null = abort). */
  prepare: () => Promise<string | null>;
  /** Called when the dialog closes after a run. */
  onFinished?: (result: { draftId: string; allOk: boolean }) => void;
};

type Phase = "confirm" | "running" | "done";

export function PublishDialog({
  open,
  onOpenChange,
  title,
  stationSlugs,
  publishMode,
  prepare,
  onFinished,
}: Props) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [runs, setRuns] = useState<Record<string, StationRunState>>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [allOk, setAllOk] = useState(false);

  function setRun(slug: string, run: StationRunState) {
    setRuns((prev) => ({ ...prev, [slug]: run }));
  }

  async function runStation(id: string, slug: string): Promise<boolean> {
    setRun(slug, { state: "running" });
    const result = await publishStationAction(id, slug);
    if (!result.ok) {
      setRun(slug, { state: "error", error: result.error });
      return false;
    }
    setRun(slug, { state: "done", publication: result.data });
    return isPublicationComplete(result.data);
  }

  async function finalize(id: string) {
    const fin = await finalizeDraftAction(id);
    const ok = fin.ok && fin.data.published;
    setAllOk(ok);
    return ok;
  }

  async function handlePublish() {
    setPhase("running");
    const id = await prepare();
    if (!id) {
      setPhase("confirm");
      return;
    }
    setDraftId(id);
    setRuns(Object.fromEntries(stationSlugs.map((s) => [s, { state: "waiting" }])));

    // One station at a time, so a failure never blocks the others.
    let failures = 0;
    for (const slug of stationSlugs) {
      if (!(await runStation(id, slug))) failures++;
    }

    const ok = await finalize(id);
    setPhase("done");
    if (ok) {
      toast.success(
        publishMode === "draft"
          ? `Created WordPress drafts on ${stationSlugs.length} station${stationSlugs.length === 1 ? "" : "s"}`
          : `Published to ${stationSlugs.length} station${stationSlugs.length === 1 ? "" : "s"}`
      );
    } else {
      toast.error(`${failures} station${failures === 1 ? "" : "s"} failed. Retry below.`);
    }
  }

  async function handleRetry(slug: string) {
    if (!draftId) return;
    setRetrying(slug);
    const ok = await runStation(draftId, slug);
    const all = await finalize(draftId);
    setRetrying(null);
    if (all) toast.success("All stations done");
    else if (ok) toast.success(`${getStationBySlug(slug)?.name ?? slug}: done`);
  }

  function handleOpenChange(next: boolean) {
    if (phase === "running") return; // don't close mid-publish
    if (!next) {
      if (phase === "done" && draftId) onFinished?.({ draftId, allOk });
      setPhase("confirm");
      setRuns({});
      setDraftId(null);
      setAllOk(false);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={phase !== "running"}>
        <DialogHeader>
          <DialogTitle>
            {phase === "confirm"
              ? publishMode === "draft"
                ? "Create WordPress drafts?"
                : "Publish now?"
              : phase === "running"
                ? "Publishing…"
                : allOk
                  ? "Done"
                  : "Finished with errors"}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">&ldquo;{title}&rdquo;</DialogDescription>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="flex flex-col gap-3">
            {publishMode === "draft" ? (
              <Alert>
                <AlertDescription>
                  Draft mode: posts are created as WordPress <strong>drafts</strong> and Facebook
                  is not triggered.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  Live mode: this goes public on each site below and is then posted to its
                  Facebook page.
                </AlertDescription>
              </Alert>
            )}
            <ul className="flex flex-col gap-1.5">
              {stationSlugs.map((slug) => (
                <li key={slug} className="rounded-md border px-3 py-2 font-medium">
                  {getStationBySlug(slug)?.name ?? slug}
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase !== "confirm" && (
          <div className="flex flex-col gap-2">
            {stationSlugs.map((slug) => (
              <StationResultRow
                key={slug}
                slug={slug}
                run={runs[slug] ?? { state: "waiting" }}
                onRetry={phase === "done" ? () => handleRetry(slug) : undefined}
                retrying={retrying === slug}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          {phase === "confirm" && (
            <>
              <Button variant="outline" className="h-11 px-5" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button className="h-11 px-6 text-base" onClick={handlePublish}>
                {publishMode === "draft"
                  ? `Create ${stationSlugs.length} draft${stationSlugs.length === 1 ? "" : "s"}`
                  : `Publish to ${stationSlugs.length} station${stationSlugs.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button className="h-11 px-6" disabled>
              <Spinner /> Working… keep this open
            </Button>
          )}
          {phase === "done" && (
            <Button className="h-11 px-6" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
