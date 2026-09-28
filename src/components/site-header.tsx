"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TITLES: Record<string, string> = {
  "/": "Queue",
  "/new": "New post",
  "/history": "History",
  "/settings": "Settings",
};

export function SiteHeader({ isDraftMode }: { isDraftMode: boolean }) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "GMB Digital";

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:rounded-t-xl">
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <span className="text-sm font-medium">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        {isDraftMode ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  variant="outline"
                  className="h-6 cursor-default gap-1.5 border-amber-300 bg-amber-50 px-2.5 text-amber-900"
                  tabIndex={0}
                />
              }
            >
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              Drafts only
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="max-w-64">
              Live publishing is off here: posts can only be saved as WordPress drafts and
              Facebook is never triggered. Set PUBLISH_MODE=live to allow Approve &amp; publish.
            </TooltipContent>
          </Tooltip>
        ) : (
          <Badge
            variant="outline"
            className="h-6 gap-1.5 border-emerald-300 bg-emerald-50 px-2.5 text-emerald-900"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Live publishing on
          </Badge>
        )}
      </div>
    </header>
  );
}
