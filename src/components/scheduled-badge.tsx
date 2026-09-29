"use client";

import { ClockIcon } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { formatRelative, formatWhen } from "@/lib/schedule-time";
import { Badge } from "@/components/ui/badge";

/** "in 3h 20m", kept fresh. Empty until the browser has a clock. */
export function Countdown({ iso }: { iso: string }) {
  const now = useNow();
  if (!now) return null;
  const target = new Date(iso);
  const relative = formatRelative(target, now);
  return <>{relative === "now" ? "due now" : relative}</>;
}

/** Badge for a scheduled draft: the New York time plus a live countdown. */
export function ScheduledBadge({ iso }: { iso: string }) {
  return (
    <Badge variant="outline" className="gap-1.5 border-sky-300 bg-sky-50 text-sky-900">
      <ClockIcon aria-hidden="true" />
      <span>
        {formatWhen(new Date(iso))} ET
        <span className="text-sky-800/80">
          {" · "}
          <Countdown iso={iso} />
        </span>
      </span>
    </Badge>
  );
}
