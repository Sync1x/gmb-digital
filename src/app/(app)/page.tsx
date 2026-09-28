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

  const [{ data, error }, { data: statusRows }] = await Promise.all([
    query,
    supabase.from("drafts").select("status"),
  ]);
  const drafts = (data ?? []) as (Draft & { publications: Publication[] })[];
  const counts: Partial<Record<DraftStatus, number>> = {};
  for (const row of (statusRows ?? []) as { status: DraftStatus }[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  const context = getDraftCardContext();

  return (
    <>
      <PageHeader
        title="Queue"
        description="Review incoming news, pick an image and stations, then publish."
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
          description="New stories from the newsletters land here automatically. You can also write one yourself."
          action={{ href: "/new", label: "New post" }}
        />
      )}

      {drafts.length > 0 && (
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
