import { createClient } from "@/lib/supabase/server";
import { DraftCard } from "@/components/draft-card";
import { StatusFilter } from "@/components/status-filter";
import { EmptyState } from "@/components/empty-state";
import { getDraftCardContext } from "@/lib/draft-card-context";
import type { Draft, DraftStatus, Publication } from "@/lib/types";

const VALID_STATUSES: DraftStatus[] = ["new", "ready", "published", "discarded"];

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

  let query = supabase
    .from("drafts")
    .select("*, publications(*)")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  } else {
    // "All" still hides discarded drafts unless you ask for them.
    query = query.neq("status", "discarded");
  }

  const { data, error } = await query;
  const drafts = (data ?? []) as (Draft & { publications: Publication[] })[];
  const context = getDraftCardContext();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
        <p className="text-sm text-muted-foreground">
          Review incoming news, pick an image and stations, then publish.
        </p>
      </div>

      <StatusFilter active={status ?? "all"} />

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load drafts: {error.message}
        </p>
      )}

      {!error && drafts.length === 0 && (
        <EmptyState
          title={status ? `No ${status} drafts` : "The queue is empty"}
          description="New stories from the newsletters land here automatically. You can also write one yourself."
          action={{ href: "/new", label: "New post" }}
        />
      )}

      <div className="flex flex-col gap-4">
        {drafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            publications={draft.publications}
            context={context}
          />
        ))}
      </div>
    </>
  );
}
