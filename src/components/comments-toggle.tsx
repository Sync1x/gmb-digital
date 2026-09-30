"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Whether the published WordPress post accepts comments. Off by default. */
export function CommentsToggle({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>Allow comments</Label>
        <p className="text-xs text-muted-foreground">
          {checked
            ? "Readers can comment on this post."
            : "Comments are turned off on this post."}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
