"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClockIcon, RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { unscheduleDraftAction, scheduleDraftAction } from "@/app/schedule-actions";
import { formatWhen } from "@/lib/schedule-time";
import type { Draft, Publication, PublishTarget } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PublishDialog } from "@/components/publish-dialog";
import { ScheduleDialog } from "@/components/schedule-dialog";

type FailedDraft = Draft & { publications: Publication[] };

/**
 * Scheduled posts that failed all their attempts, at the top of the queue.
 * Retry now goes through the normal publish dialog (so you see each station);
 * Reschedule puts it back on the schedule.
 */
export function FailedScheduleAlerts({
  drafts,
  liveEnabled,
}: {
  drafts: FailedDraft[];
  liveEnabled: boolean;
}) {
  if (drafts.length === 0) return null;
  return (
    <section aria-label="Failed scheduled posts" className="flex flex-col gap-3">
      {drafts.map((draft) => (
        <FailedAlert key={draft.id} draft={draft} liveEnabled={liveEnabled} />
      ))}
    </section>
  );
}

function FailedAlert({ draft, liveEnabled }: { draft: FailedDraft; liveEnabled: boolean }) {
  const router = useRouter();
  const [retryOpen, setRetryOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const target: PublishTarget = liveEnabled ? "live" : "draft";
  const title = draft.title?.trim() || "Untitled";

  async function prepareRetry(): Promise<string | null> {
    // Off the failed state first, so nothing else touches it mid-publish.
    const released = await unscheduleDraftAction(draft.id);
    if (!released.ok) {
      toast.error(released.error);
      return null;
    }
    return draft.id;
  }

  async function reschedule(iso: string): Promise<string | null> {
    const result = await scheduleDraftAction(draft.id, iso);
    if (!result.ok) return result.error;
    toast.success(`Scheduled for ${formatWhen(new Date(result.data.scheduledFor))} ET`);
    router.refresh();
    return null;
  }

  return (
    <Alert variant="destructive" className="gap-y-1 border-destructive/40 bg-destructive/5 p-3">
      <TriangleAlertIcon aria-hidden="true" />
      <AlertTitle className="text-base">Scheduled post failed: {title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          {draft.last_publish_error ?? "Publishing failed."}{" "}
          <span className="text-muted-foreground">
            Tried {draft.publish_attempts} time{draft.publish_attempts === 1 ? "" : "s"}, so it
            stopped.
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button className="h-9" onClick={() => setRetryOpen(true)}>
            <RotateCwIcon aria-hidden="true" />
            Retry now
          </Button>
          <Button variant="outline" className="h-9" onClick={() => setRescheduleOpen(true)}>
            <CalendarClockIcon aria-hidden="true" />
            Reschedule
          </Button>
          <Link
            href={`/?status=failed#draft-${draft.id}`}
            className="text-sm underline underline-offset-4"
          >
            Open to edit
          </Link>
        </div>
      </AlertDescription>

      <PublishDialog
        open={retryOpen}
        onOpenChange={setRetryOpen}
        title={title}
        stationSlugs={draft.stations}
        target={target}
        publications={draft.publications}
        prepare={prepareRetry}
        onFinished={() => router.refresh()}
      />
      <ScheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        title={title}
        stationSlugs={draft.stations}
        liveEnabled={liveEnabled}
        onConfirm={reschedule}
      />
    </Alert>
  );
}
