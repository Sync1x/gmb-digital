"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { testMainwpConnection } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function TestConnectionButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await testMainwpConnection();
      if (result.ok) {
        toast.success(`Connected to MainWP: ${result.siteCount} child sites found`);
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending} className="h-10 px-4">
      {isPending && <Spinner />}
      {isPending ? "Testing…" : "Test connection"}
    </Button>
  );
}
