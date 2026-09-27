"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setDraftStatus, updateDraft } from "@/app/actions";
import { getPublishProblems } from "@/lib/publications";
import type { Draft, DraftCardContext, DraftStatus, Publication } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImagePicker } from "@/components/image-picker";
import { StationPicker } from "@/components/station-picker";
import { SuggestTitleButton } from "@/components/suggest-title-button";
import { PublishDialog } from "@/components/publish-dialog";
import { PublicationStatus } from "@/components/publication-status";

const STATUS_LABEL: Record<DraftStatus, string> = {
  new: "New",
  ready: "Ready",
  published: "Published",
  discarded: "Discarded",
};

const STATUS_VARIANT: Record<DraftStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "secondary",
  ready: "default",
  published: "outline",
  discarded: "destructive",
};

export function DraftCard({
  draft,
  publications,
  context,
}: {
  draft: Draft;
  publications: Publication[];
  context: DraftCardContext;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(draft.title ?? "");
  const [body, setBody] = useState(draft.body);
  const [selectedStations, setSelectedStations] = useState<string[]>(draft.stations);
  const [imageUrl, setImageUrl] = useState<string | null>(draft.featured_image_url);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const isFinal = draft.status === "published" || draft.status === "discarded";
  const problems = getPublishProblems({
    title,
    body,
    featuredImageUrl: imageUrl,
    stations: selectedStations,
  });

  function edits() {
    return { title: title.trim() || null, body, stations: selectedStations };
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPendingAction(label);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong");
      setPendingAction(null);
    });
  }

  async function prepareForPublish(): Promise<string | null> {
    const result = await updateDraft(draft.id, edits());
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    return draft.id;
  }

  return (
    <Card className="gap-5">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={draft.source_type === "newsletter" ? "secondary" : "outline"}>
              {draft.source_type === "newsletter" ? "Newsletter" : "Manual"}
              {draft.source_sender ? ` · ${draft.source_sender}` : ""}
            </Badge>
            <Badge variant={STATUS_VARIANT[draft.status]}>{STATUS_LABEL[draft.status]}</Badge>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {new Date(draft.created_at).toLocaleString()}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            disabled={isFinal}
            aria-label="Title"
            className="h-11 text-lg font-semibold"
          />
          {context.aiEnabled && !isFinal && (
            <SuggestTitleButton body={body} currentTitle={title} onPick={setTitle} />
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isFinal}
          aria-label="Story text"
          rows={8}
          className="whitespace-pre-wrap"
        />

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Featured image</Label>
          <ImagePicker
            draftId={draft.id}
            imageUrl={imageUrl}
            onChange={setImageUrl}
            defaultQuery={title}
            disabled={isFinal}
          />
        </div>

        <StationPicker
          idPrefix={draft.id}
          selected={selectedStations}
          onChange={setSelectedStations}
          disabled={isFinal}
        />

        {publications.length > 0 && (
          <>
            <Separator />
            <PublicationStatus draftId={draft.id} publications={publications} />
          </>
        )}
      </CardContent>

      {!isFinal && (
        <CardFooter className="flex flex-col items-stretch gap-3 border-t pt-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              className="h-11 px-4 text-muted-foreground"
              onClick={() => setConfirmDiscardOpen(true)}
              disabled={isPending}
            >
              Discard
            </Button>
            <Button
              variant="outline"
              className="h-11 px-5"
              disabled={isPending}
              onClick={() => run("save", () => updateDraft(draft.id, edits()), "Draft saved")}
            >
              {pendingAction === "save" && <Spinner />}
              Save
            </Button>
            {draft.status === "new" && (
              <Button
                variant="secondary"
                className="h-11 px-5"
                disabled={isPending}
                onClick={() =>
                  run(
                    "ready",
                    () => updateDraft(draft.id, { ...edits(), status: "ready" }),
                    "Marked ready"
                  )
                }
              >
                {pendingAction === "ready" && <Spinner />}
                Mark ready
              </Button>
            )}
            <Button
              className="h-11 px-6 text-base"
              disabled={isPending || problems.length > 0}
              onClick={() => setPublishOpen(true)}
            >
              {context.publishMode === "draft" ? "Publish (draft mode)" : "Publish"}
            </Button>
          </div>
          {problems.length > 0 && (
            <p className="text-right text-sm text-muted-foreground">
              To publish, add {problems.join(", ")}.
            </p>
          )}
        </CardFooter>
      )}

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={title}
        stationSlugs={selectedStations}
        publishMode={context.publishMode}
        prepare={prepareForPublish}
        onFinished={() => router.refresh()}
      />

      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              It will be marked as discarded and dropped from the active queue. You can still
              find it under the Discarded filter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscardOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscardOpen(false);
                run("discard", () => setDraftStatus(draft.id, "discarded"), "Draft discarded");
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
