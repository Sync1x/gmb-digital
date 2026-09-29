import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DraftStatus } from "@/lib/types";

const FILTERS: { label: string; value: DraftStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Ready", value: "ready" },
  { label: "Published", value: "published" },
  { label: "Failed", value: "failed" },
  { label: "Discarded", value: "discarded" },
];

/** Links, not tabs: each filter is its own URL, so it survives a reload. */
export function StatusFilter({
  active,
  counts,
}: {
  active: string;
  counts?: Partial<Record<DraftStatus, number>>;
}) {
  return (
    <nav aria-label="Filter drafts by status">
      <ul className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1">
        {FILTERS.map((filter) => {
          const isActive = active === filter.value;
          const href = filter.value === "all" ? "/" : `/?status=${filter.value}`;
          const count = filter.value === "all" ? undefined : counts?.[filter.value];
          return (
            <li key={filter.value}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.label}
                {count !== undefined && count > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
