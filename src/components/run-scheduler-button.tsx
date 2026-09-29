"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlayIcon } from "lucide-react";
import { runSchedulerNow } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function RunSchedulerButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await runSchedulerNow();
      if (result.ok) {
        const r = result.data;
        const text = `Claimed ${r.claimed}, published ${r.published}, failed ${r.failed}, late ${r.late}`;
        if (r.failed > 0) toast.error(text);
        else toast.success(r.claimed === 0 ? "Ran: nothing was due." : text);
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending} className="h-10 px-4">
      {isPending ? <Spinner /> : <PlayIcon aria-hidden="true" />}
      {isPending ? "Running…" : "Run now"}
    </Button>
  );
}
