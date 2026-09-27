"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SparklesIcon } from "lucide-react";
import { suggestTitlesAction } from "@/app/ai-actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Render only when AI is enabled; callers check `aiEnabled` from the server. */
export function SuggestTitleButton({
  body,
  currentTitle,
  onPick,
  disabled,
}: {
  body: string;
  currentTitle: string;
  onPick: (title: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [titles, setTitles] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function fetchTitles() {
    startTransition(async () => {
      const result = await suggestTitlesAction(body, currentTitle || null);
      if (result.ok) {
        setTitles(result.data);
      } else {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  function handleOpen() {
    if (!body.trim()) {
      toast.error("Add the story text first.");
      return;
    }
    setTitles([]);
    setOpen(true);
    fetchTitles();
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen} disabled={disabled} className="h-10 px-4">
        <SparklesIcon />
        Suggest title
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pick a headline</DialogTitle>
            <DialogDescription>Suggestions from the story text. Check facts before using one.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {isPending &&
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            {!isPending &&
              titles.map((t) => (
                <Button
                  key={t}
                  variant="outline"
                  className="h-auto min-h-12 justify-start px-4 py-3 text-left text-base whitespace-normal"
                  onClick={() => {
                    onPick(t);
                    setOpen(false);
                    toast.success("Title updated. Remember to save.");
                  }}
                >
                  {t}
                </Button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={fetchTitles} disabled={isPending}>
              {isPending && <Spinner />}
              Try again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
