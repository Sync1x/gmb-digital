"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClockIcon,
  CalendarXIcon,
  FileTextIcon,
  RotateCwIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { setDraftStatus, updateDraft } from "@/app/actions";
import { scheduleDraftAction, unscheduleDraftAction } from "@/app/schedule-actions";
import { formatWhen } from "@/lib/schedule-time";
import { getPublishProblems, isWordpressDraft } from "@/lib/publications";
import type {
  Draft,
  DraftCardContext,
  DraftStatus,
  Publication,
  PublishTarget,
} from "@/lib/types";
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
import { CategoryPicker } from "@/components/category-picker";
import { SuggestTitleButton } from "@/components/suggest-title-button";
import { PublishDialog } from "@/components/publish-dialog";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { Countdown, ScheduledBadge } from "@/components/scheduled-badge";
import { PublicationStatus } from "@/components/publication-status";

const STATUS_LABEL: Record<DraftStatus, string> = {
  new: "New",
  ready: "Ready",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  discarded: "Discarded",
};

const STATUS_VARIANT: Record<DraftStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "secondary",
  ready: "default",
  scheduled: "default",
  publishing: "secondary",
  published: "outline",
  failed: "destructive",
  discarded: "destructive",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

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
  const [categories, setCategories] = useState<string[]>(draft.categories ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(draft.featured_image_url);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<PublishTarget | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const isScheduled = draft.status === "scheduled";
  const isPublishing = draft.status === "publishing";
  const isFailed = draft.status === "failed";
  const isFinal = draft.status === "published" || draft.status === "discarded";
  // The scheduler owns a draft while it publishes it: read-only until it's done.
  const locked = isFinal || isPublishing;
  // Publish now / Retry now: goes live when allowed, otherwise a WordPress draft.
  const nowTarget: PublishTarget = context.liveEnabled ? "live" : "draft";
  const hasWordpressDrafts = publications.some(isWordpressDraft);
  const problems = getPublishProblems({
    title,
    body,
    featuredImageUrl: imageUrl,
    stations: selectedStations,
  });

  function edits() {
    return { title: title.trim() || null, body, stations: selectedStations, categories };
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
    if (isScheduled || isFailed) {
      // Take it off the schedule first so the scheduler can't also pick it up.
      const released = await unscheduleDraftAction(draft.id);
      if (!released.ok) {
        toast.error(released.error);
        return null;
      }
    }
    return draft.id;
  }

  /** Saves the card's edits, then sets the schedule. Returns an error message or null. */
  async function confirmSchedule(scheduledForIso: string): Promise<string | null> {
    const saved = await updateDraft(draft.id, edits());
    if (!saved.ok) return saved.error;
    const result = await scheduleDraftAction(draft.id, scheduledForIso);
    if (!result.ok) return result.error;
    toast.success(`Scheduled for ${formatWhen(new Date(result.data.scheduledFor))} ET`);
    router.refresh();
    return null;
  }

  const headingId = `draft-${draft.id}-title`;

  return (
    <Card id={`draft-${draft.id}`} role="article" className="gap-0 py-0" aria-labelledby={headingId}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[draft.status]}>{STATUS_LABEL[draft.status]}</Badge>
          {isScheduled && draft.scheduled_for && <ScheduledBadge iso={draft.scheduled_for} />}
          {isScheduled && draft.edited_after_scheduling && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              Edited after scheduling
            </Badge>
          )}
          {hasWordpressDrafts && !isFinal && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              In WordPress as draft
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {draft.source_type === "newsletter" ? "Newsletter" : "Manual"}
            {draft.source_sender ? ` · ${draft.source_sender}` : ""}
          </span>
        </div>
        <time
          dateTime={draft.created_at}
          className="text-sm text-muted-foreground tabular-nums"
          suppressHydrationWarning
        >
          {formatDate(draft.created_at)}
        </time>
      </CardHeader>

      <CardContent className="grid gap-6 py-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 id={headingId} className="sr-only">
            {title.trim() || "Untitled draft"}
          </h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${draft.id}-title`}>Headline</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`${draft.id}-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                disabled={locked}
                className="h-10 text-base font-medium"
              />
              {context.aiEnabled && !locked && (
                <SuggestTitleButton body={body} currentTitle={title} onPick={setTitle} />
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${draft.id}-body`}>Story</Label>
            <Textarea
              id={`${draft.id}-body`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={locked}
              rows={9}
              className="min-h-48 leading-relaxed whitespace-pre-wrap"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Featured image</span>
            <ImagePicker
              draftId={draft.id}
              imageUrl={imageUrl}
              onChange={setImageUrl}
              defaultQuery={title}
              stationSlugs={selectedStations}
              disabled={locked}
            />
          </div>

          <StationPicker
            idPrefix={draft.id}
            selected={selectedStations}
            onChange={setSelectedStations}
            disabled={locked}
            showSelectAll
          />

          <CategoryPicker
            id={`${draft.id}-categories`}
            selectedStations={selectedStations}
            categoriesByStation={context.categoriesByStation}
            value={categories}
            onChange={setCategories}
            disabled={locked}
          />
        </div>

        {publications.length > 0 && (
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Separator />
            <PublicationStatus draftId={draft.id} publications={publications} />
          </div>
        )}
      </CardContent>

      {isPublishing && (
        <CardFooter className="gap-2 border-t bg-muted/40 py-3 text-sm text-muted-foreground">
          <Spinner /> The scheduler is publishing this now. It will update here when it&apos;s done.
        </CardFooter>
      )}

      {!locked && (
        <CardFooter className="flex flex-col items-stretch gap-3 border-t bg-muted/40 py-3 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {isScheduled && draft.scheduled_for ? (
              <>
                Goes out {formatWhen(new Date(draft.scheduled_for))} ET (<Countdown iso={draft.scheduled_for} />).
                {draft.edited_after_scheduling
                  ? " You edited it after scheduling; the latest version is what goes out."
                  : " Editing keeps it scheduled."}
                {draft.publish_attempts > 0 && draft.last_publish_error
                  ? ` Last attempt failed: ${draft.last_publish_error}`
                  : ""}
              </>
            ) : isFailed ? (
              `Scheduled publishing failed after ${draft.publish_attempts} attempts${draft.last_publish_error ? `: ${draft.last_publish_error}` : "."}`
            ) : problems.length > 0 ? (
              `To publish, add ${problems.join(", ")}.`
            ) : !context.liveEnabled ? (
              "Live publishing is off here, so it can only be saved as a WordPress draft."
            ) : hasWordpressDrafts ? (
              "Drafts are waiting in WordPress. Approve to publish them."
            ) : (
              "Ready to publish."
            )}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              className="h-10 px-3 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDiscardOpen(true)}
              disabled={isPending}
            >
              <Trash2Icon aria-hidden="true" />
              Discard
            </Button>
            <Button
              variant="outline"
              className="h-10 px-4"
              disabled={isPending}
              onClick={() => run("save", () => updateDraft(draft.id, edits()), "Draft saved")}
            >
              {pendingAction === "save" && <Spinner />}
              Save
            </Button>

            {isScheduled || isFailed ? (
              <>
                <Button
                  variant="outline"
                  className="h-10 px-4"
                  disabled={isPending || problems.length > 0}
                  onClick={() => setScheduleOpen(true)}
                >
                  <CalendarClockIcon aria-hidden="true" />
                  Reschedule
                </Button>
                {isScheduled && (
                  <Button
                    variant="outline"
                    className="h-10 px-4"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        "unschedule",
                        () => unscheduleDraftAction(draft.id),
                        "Unscheduled. Back to ready."
                      )
                    }
                  >
                    {pendingAction === "unschedule" ? <Spinner /> : <CalendarXIcon aria-hidden="true" />}
                    Unschedule
                  </Button>
                )}
                <Button
                  className="h-10 px-5"
                  disabled={isPending || problems.length > 0}
                  onClick={() => setPublishTarget(nowTarget)}
                >
                  {isFailed ? <RotateCwIcon aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
                  {isFailed ? "Retry now" : nowTarget === "live" ? "Publish now" : "Save draft now"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="h-10 px-4"
                  disabled={isPending || problems.length > 0}
                  onClick={() => setPublishTarget("draft")}
                >
                  <FileTextIcon aria-hidden="true" />
                  {hasWordpressDrafts ? "Update WordPress draft" : "Save as WordPress draft"}
                </Button>
                <Button
                  variant="outline"
                  className="h-10 px-4"
                  disabled={isPending || problems.length > 0}
                  onClick={() => setScheduleOpen(true)}
                >
                  <CalendarClockIcon aria-hidden="true" />
                  Schedule
                </Button>
                <Button
                  className="h-10 px-5"
                  disabled={isPending || problems.length > 0 || !context.liveEnabled}
                  onClick={() => setPublishTarget("live")}
                >
                  <SendIcon aria-hidden="true" />
                  Approve &amp; publish
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      )}

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title={title}
        stationSlugs={selectedStations}
        currentIso={isScheduled ? draft.scheduled_for : null}
        liveEnabled={context.liveEnabled}
        onConfirm={confirmSchedule}
      />

      <PublishDialog
        open={publishTarget !== null}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        title={title}
        stationSlugs={selectedStations}
        target={publishTarget ?? "draft"}
        publications={publications}
        prepare={prepareForPublish}
        onFinished={() => router.refresh()}
      />

      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              It will be marked as discarded and dropped from the active queue. You can still find
              it under the Discarded filter.
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
