"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong loading this page</AlertTitle>
        <AlertDescription>
          {error.message || "Unexpected error."}
          {error.digest ? ` (ref ${error.digest})` : ""}
        </AlertDescription>
      </Alert>
      <Button className="h-11 px-5" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
