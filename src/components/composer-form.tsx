"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveManualDraft } from "@/app/actions";
import { getPublishProblems } from "@/lib/publications";
import type { DraftCardContext } from "@/lib/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ImagePicker } from "@/components/image-picker";
import { StationPicker } from "@/components/station-picker";
import { SuggestTitleButton } from "@/components/suggest-title-button";
import { PublishDialog } from "@/components/publish-dialog";

export function ComposerForm({ context }: { context: DraftCardContext }) {
  const router = useRouter();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [sender, setSender] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
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
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="composer-sender">From (optional)</Label>
          <Input
            id="composer-sender"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="Who sent it, e.g. Selectboard chair via Messenger"
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="composer-title">Title</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="composer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Plain, factual headline"
              className="h-11 text-lg font-semibold"
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
            className="min-h-72 whitespace-pre-wrap"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Featured image</Label>
          <ImagePicker
            draftId={savedId}
            imageUrl={imageUrl}
            onChange={setImageUrl}
            defaultQuery={title}
          />
        </div>

        <StationPicker
          idPrefix="composer"
          selected={selectedStations}
          onChange={setSelectedStations}
          showSelectAll
        />
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 border-t pt-5">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="h-11 px-5"
            onClick={handleSaveDraft}
            disabled={isSaving || !body.trim()}
          >
            {isSaving && <Spinner />}
            Save as draft
          </Button>
          <Button
            className="h-11 px-6 text-base"
            onClick={() => setPublishOpen(true)}
            disabled={isSaving || problems.length > 0}
          >
            {context.publishMode === "draft" ? "Publish now (draft mode)" : "Publish now"}
          </Button>
        </div>
        {problems.length > 0 && (
          <p className="text-right text-sm text-muted-foreground">
            To publish, add {problems.join(", ")}.
          </p>
        )}
      </CardFooter>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={title}
        stationSlugs={selectedStations}
        publishMode={context.publishMode}
        prepare={() => save("ready")}
        onFinished={({ allOk }) => router.push(allOk ? "/history" : "/?status=ready")}
      />
    </Card>
  );
}
