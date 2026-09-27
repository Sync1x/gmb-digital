import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DraftStatus } from "@/lib/types";

const FILTERS: { label: string; value: DraftStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Ready", value: "ready" },
  { label: "Published", value: "published" },
  { label: "Discarded", value: "discarded" },
];

export function StatusFilter({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const isActive = active === filter.value;
        const href = filter.value === "all" ? "/" : `/?status=${filter.value}`;
        return (
          <Link
            key={filter.value}
            href={href}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground hover:bg-muted"
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
