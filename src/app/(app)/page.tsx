import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DraftCard } from "@/components/draft-card";
import { StatusFilter } from "@/components/status-filter";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDraftCardContext } from "@/lib/draft-card-context";
import { cn } from "@/lib/utils";
import { dayKey, dayLabel } from "@/lib/schedule-time";
import type { Draft, DraftStatus, Publication } from "@/lib/types";

const VALID_STATUSES: DraftStatus[] = [
  "new",
  "ready",
  "scheduled",
  "published",
  "failed",
  "discarded",
];

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = VALID_STATUSES.includes(rawStatus as DraftStatus)
    ? (rawStatus as DraftStatus)
    : undefined;

  const supabase = await createClient();

  let query = supabase.from("drafts").select("*, publications(*)");

  if (status === "scheduled") {
    // Soonest first. A draft being published right now still counts as scheduled.
    query = query
      .in("status", ["scheduled", "publishing"])
      .order("scheduled_for", { ascending: true });
  } else if (status) {
    query = query.eq("status", status).order("created_at", { ascending: false });
  } else {
    // "All" still hides discarded drafts unless you ask for them.
    query = query.neq("status", "discarded").order("created_at", { ascending: false });
  }

  const [{ data, error }, { data: statusRows }] = await Promise.all([
    query,
    supabase.from("drafts").select("status"),
  ]);
  const drafts = (data ?? []) as (Draft & { publications: Publication[] })[];
  const counts: Partial<Record<DraftStatus, number>> = {};
  for (const row of (statusRows ?? []) as { status: DraftStatus }[]) {
    // "publishing" is the tail end of scheduled.
    const key = row.status === "publishing" ? "scheduled" : row.status;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Scheduled view: one heading per New York day ("Today", "Tomorrow", then dates).
  const now = new Date();
  const groups: { key: string; label: string; drafts: typeof drafts }[] = [];
  if (status === "scheduled") {
    for (const draft of drafts) {
      const when = new Date(draft.scheduled_for ?? draft.created_at);
      const key = dayKey(when);
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = { key, label: dayLabel(when, now), drafts: [] };
        groups.push(group);
      }
      group.drafts.push(draft);
    }
  }
  const context = await getDraftCardContext();

  return (
    <>
      <PageHeader
        title="Queue"
        description="Review incoming news, pick an image, stations and categories, then approve to publish."
        actions={
          <Link href="/new" className={cn(buttonVariants(), "h-9 px-4")}>
            <PlusIcon aria-hidden="true" />
            New post
          </Link>
        }
      />

      <StatusFilter active={status ?? "all"} counts={counts} />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load drafts</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {!error && drafts.length === 0 && (
        <EmptyState
          title={status ? `No ${status} drafts` : "The queue is empty"}
          description={
            status === "scheduled"
              ? "Nothing is scheduled. Use Schedule on a draft to send it out later."
              : "New stories from the newsletters land here automatically. You can also write one yourself."
          }
          action={{ href: "/new", label: "New post" }}
        />
      )}

      {status === "scheduled" && groups.length > 0 && (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`day-${group.key}`} className="flex flex-col gap-3">
              <h2 id={`day-${group.key}`} className="text-sm font-semibold text-muted-foreground">
                {group.label}
                <span className="ml-2 font-normal tabular-nums">{group.drafts.length}</span>
              </h2>
              <ul className="flex flex-col gap-4" aria-label={`Scheduled ${group.label}`}>
                {group.drafts.map((draft) => (
                  <li key={draft.id}>
                    <DraftCard draft={draft} publications={draft.publications} context={context} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {status !== "scheduled" && drafts.length > 0 && (
        <ul className="flex flex-col gap-4" aria-label="Drafts">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <DraftCard draft={draft} publications={draft.publications} context={context} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
