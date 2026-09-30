"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClockIcon, FileTextIcon, SendIcon } from "lucide-react";
import { saveManualDraft } from "@/app/actions";
import { scheduleDraftAction } from "@/app/schedule-actions";
import { formatWhen } from "@/lib/schedule-time";
import { getPublishProblems } from "@/lib/publications";
import type { DraftCardContext, PublishTarget } from "@/lib/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ImagePicker } from "@/components/image-picker";
import { StationPicker } from "@/components/station-picker";
import { CategoryPicker } from "@/components/category-picker";
import { CommentsToggle } from "@/components/comments-toggle";
import { SuggestTitleButton } from "@/components/suggest-title-button";
import { PublishDialog } from "@/components/publish-dialog";
import { ScheduleDialog } from "@/components/schedule-dialog";

export function ComposerForm({ context }: { context: DraftCardContext }) {
  const router = useRouter();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [sender, setSender] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  // undefined until touched: untouched drafts keep the default (closed) without writing the column.
  const [allowComments, setAllowComments] = useState<boolean | undefined>(undefined);
  const [publishTarget, setPublishTarget] = useState<PublishTarget | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [isSaving, startSave] = useTransition();

  const problems = getPublishProblems({
    title,
    body,
    featuredImageUrl: imageUrl,
    stations: selectedStations,
  });

  async function save(status: "new" | "ready") {
    const result = await saveManualDraft({
      id: savedId,
      title,
      body,
      sender,
      stations: selectedStations,
      categories,
      allowComments,
      featuredImageUrl: imageUrl,
      status,
    });
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    setSavedId(result.data);
    return result.data;
  }

  /** Saves the post, then schedules it. Returns an error message or null. */
  async function confirmSchedule(scheduledForIso: string): Promise<string | null> {
    const id = await save("ready");
    if (!id) return "Couldn't save the post. Check the message above and try again.";
    const result = await scheduleDraftAction(id, scheduledForIso);
    if (!result.ok) return result.error;
    toast.success(`Scheduled for ${formatWhen(new Date(result.data.scheduledFor))} ET`);
    router.push("/?status=scheduled");
    return null;
  }

  function handleSaveDraft() {
    startSave(async () => {
      const id = await save("new");
      if (id) {
        toast.success("Saved to the queue");
        router.push("/");
      }
    });
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="composer-title">Headline</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="composer-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Plain, factual headline"
                className="h-10 text-base font-medium"
              />
              {context.aiEnabled && (
                <SuggestTitleButton body={body} currentTitle={title} onPick={setTitle} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="composer-body">Story</Label>
            <Textarea
              id="composer-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the text here. Line breaks are kept; a blank line starts a new paragraph."
              rows={14}
              className="min-h-72 leading-relaxed whitespace-pre-wrap"
              aria-describedby="composer-body-hint"
            />
            <p id="composer-body-hint" className="text-xs text-muted-foreground">
              A blank line starts a new paragraph.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="composer-sender">
              From <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="composer-sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="Who sent it, e.g. Selectboard chair via Messenger"
              className="h-10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Featured image</span>
            <ImagePicker
              draftId={savedId}
              imageUrl={imageUrl}
              onChange={setImageUrl}
              defaultQuery={title}
              stationSlugs={selectedStations}
            />
          </div>

          <StationPicker
            idPrefix="composer"
            selected={selectedStations}
            onChange={setSelectedStations}
            showSelectAll
          />

          <CategoryPicker
            id="composer-categories"
            selectedStations={selectedStations}
            categoriesByStation={context.categoriesByStation}
            value={categories}
            onChange={setCategories}
          />

          <CommentsToggle
            id="composer-comments"
            checked={allowComments === true}
            onChange={setAllowComments}
          />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 border-t bg-muted/40 py-3 xl:flex-row xl:items-center xl:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {problems.length > 0
            ? `To publish, add ${problems.join(", ")}.`
            : context.liveEnabled
              ? "Ready to publish."
              : "Live publishing is off here, so it can only be saved as a WordPress draft."}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="h-10 px-4"
            onClick={handleSaveDraft}
            disabled={isSaving || !body.trim()}
          >
            {isSaving && <Spinner />}
            Save to queue
          </Button>
          <Button
            variant="outline"
            className="h-10 px-4"
            onClick={() => setPublishTarget("draft")}
            disabled={isSaving || problems.length > 0}
          >
            <FileTextIcon aria-hidden="true" />
            Save as WordPress draft
          </Button>
          <Button
            variant="outline"
            className="h-10 px-4"
            onClick={() => setScheduleOpen(true)}
            disabled={isSaving || problems.length > 0}
          >
            <CalendarClockIcon aria-hidden="true" />
            Schedule
          </Button>
          <Button
            className="h-10 px-5"
            onClick={() => setPublishTarget("live")}
            disabled={isSaving || problems.length > 0 || !context.liveEnabled}
          >
            <SendIcon aria-hidden="true" />
            Publish now
          </Button>
        </div>
      </CardFooter>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        title={title}
        stationSlugs={selectedStations}
        liveEnabled={context.liveEnabled}
        onConfirm={confirmSchedule}
      />

      <PublishDialog
        open={publishTarget !== null}
        onOpenChange={(open) => !open && setPublishTarget(null)}
        title={title}
        stationSlugs={selectedStations}
        target={publishTarget ?? "draft"}
        prepare={() => save("ready")}
        onFinished={({ allOk }) =>
          router.push(allOk && publishTarget === "live" ? "/history" : "/?status=ready")
        }
      />
    </Card>
  );
}
