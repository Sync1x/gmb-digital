"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDraftStatus, updateDraft } from "@/app/actions";
import { stations } from "@/config/stations";
import type { Draft, DraftStatus } from "@/lib/types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_LABEL: Record<DraftStatus, string> = {
  new: "New",
  ready: "Ready",
  published: "Published",
  discarded: "Discarded",
};

const STATUS_VARIANT: Record<
  DraftStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  new: "secondary",
  ready: "default",
  published: "outline",
  discarded: "destructive",
};

export function DraftCard({ draft }: { draft: Draft }) {
  const [title, setTitle] = useState(draft.title ?? "");
  const [body, setBody] = useState(draft.body);
  const [selectedStations, setSelectedStations] = useState<string[]>(
    draft.stations
  );
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isFinal = draft.status === "published" || draft.status === "discarded";

  function toggleStation(slug: string, checked: boolean) {
    setSelectedStations((prev) =>
      checked ? [...prev, slug] : prev.filter((s) => s !== slug)
    );
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateDraft(draft.id, {
          title: title.trim() || null,
          body,
          stations: selectedStations,
        });
        toast.success("Draft saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  function handleMarkReady() {
    startTransition(async () => {
      try {
        // Save any pending edits along with the status change.
        await updateDraft(draft.id, {
          title: title.trim() || null,
          body,
          stations: selectedStations,
          status: "ready",
        });
        toast.success("Marked ready");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update");
      }
    });
  }

  function handleDiscard() {
    setConfirmDiscardOpen(false);
    startTransition(async () => {
      try {
        await setDraftStatus(draft.id, "discarded");
        toast.success("Draft discarded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to discard");
      }
    });
  }

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={draft.source_type === "newsletter" ? "secondary" : "outline"}>
              {draft.source_type === "newsletter" ? "Newsletter" : "Manual"}
              {draft.source_sender ? ` · ${draft.source_sender}` : ""}
            </Badge>
            <Badge variant={STATUS_VARIANT[draft.status]}>
              {STATUS_LABEL[draft.status]}
            </Badge>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {new Date(draft.created_at).toLocaleString()}
          </span>
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          disabled={isFinal}
          className="text-lg font-semibold"
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isFinal}
          rows={6}
        />

        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">Stations</Label>
          <div className="flex flex-wrap gap-4">
            {stations.map((station) => (
              <div key={station.slug} className="flex items-center gap-2">
                <Checkbox
                  id={`${draft.id}-${station.slug}`}
                  checked={selectedStations.includes(station.slug)}
                  disabled={isFinal}
                  onCheckedChange={(checked) =>
                    toggleStation(station.slug, checked === true)
                  }
                />
                <Label
                  htmlFor={`${draft.id}-${station.slug}`}
                  className="font-normal"
                >
                  {station.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {!isFinal && (
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmDiscardOpen(true)}
            disabled={isPending}
          >
            Discard
          </Button>
          <Button variant="secondary" onClick={handleSave} disabled={isPending}>
            Save
          </Button>
          <Button onClick={handleMarkReady} disabled={isPending} size="lg">
            Mark ready
          </Button>
        </CardFooter>
      )}

      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              It will be marked as discarded and dropped from the active
              queue. This can&apos;t be undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscardOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
