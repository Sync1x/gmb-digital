import { createClient } from "@/lib/supabase/server";
import { DraftCard } from "@/components/draft-card";
import { StatusFilter } from "@/components/status-filter";
import { Button } from "@/components/ui/button";
import type { Draft, DraftStatus } from "@/lib/types";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("drafts")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  const drafts = (data ?? []) as Draft[];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            GMB Digital
          </h1>
          <p className="text-sm text-muted-foreground">
            Review incoming news and publish to your stations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="text-sm text-muted-foreground">{user.email}</span>
          )}
          <form action="/auth/logout" method="post">
            <Button variant="outline" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <StatusFilter active={status ?? "all"} />

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load drafts: {error.message}
        </p>
      )}

      {!error && drafts.length === 0 && (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No drafts here yet.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {drafts.map((draft) => (
          <DraftCard key={draft.id} draft={draft} />
        ))}
      </div>
    </div>
  );
}
