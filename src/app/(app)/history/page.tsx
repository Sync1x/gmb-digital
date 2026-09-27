/* eslint-disable @next/next/no-img-element -- Supabase Storage URLs */
import { ExternalLinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStationBySlug } from "@/config/stations";
import type { Draft, Publication } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "History · GMB Digital" };

type Row = Publication & {
  draft: Pick<Draft, "id" | "title" | "featured_image_url" | "source_type" | "source_sender"> | null;
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("publications")
    .select("*, draft:drafts(id, title, featured_image_url, source_type, source_sender)")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as Row[];

  // Group station results under their story, newest story first.
  const groups: { draft: NonNullable<Row["draft"]>; pubs: Row[]; latest: string }[] = [];
  const byDraft = new Map<string, (typeof groups)[number]>();
  for (const row of rows) {
    if (!row.draft) continue;
    let group = byDraft.get(row.draft_id);
    if (!group) {
      group = { draft: row.draft, pubs: [], latest: row.updated_at };
      byDraft.set(row.draft_id, group);
      groups.push(group);
    }
    group.pubs.push(row);
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          Everything posted to the station sites, newest first.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load history: {error.message}
        </p>
      )}

      {!error && groups.length === 0 && (
        <EmptyState
          title="Nothing published yet"
          description="Once you publish a story from the queue or New post, it shows up here with links to each station's post."
          action={{ href: "/", label: "Go to the queue" }}
        />
      )}

      <div className="flex flex-col gap-4">
        {groups.map(({ draft, pubs, latest }) => (
          <Card key={draft.id}>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              {draft.featured_image_url && (
                <img
                  src={draft.featured_image_url}
                  alt=""
                  className="aspect-video w-full rounded-md border object-cover sm:w-44"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold leading-snug">
                    {draft.title || "Untitled"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date(latest).toLocaleString()} ·{" "}
                    {draft.source_type === "newsletter" ? "Newsletter" : "Manual"}
                    {draft.source_sender ? ` · ${draft.source_sender}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {pubs.map((p) => (
                    <Badge key={p.id} variant="secondary">
                      {getStationBySlug(p.station_slug)?.name ?? p.station_slug}
                    </Badge>
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Station</TableHead>
                      <TableHead>Post</TableHead>
                      <TableHead>Facebook</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pubs.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {getStationBySlug(p.station_slug)?.name ?? p.station_slug}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            {p.publish_mode === "draft" && (
                              <Badge variant="outline">WordPress draft</Badge>
                            )}
                            {p.post_url ? (
                              <a
                                href={p.post_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 underline underline-offset-4"
                              >
                                View post <ExternalLinkIcon className="size-3.5" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">
                                Post #{p.wp_post_id} (no link returned)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.facebook_triggered_at ? (
                            <Badge variant="secondary">Yes</Badge>
                          ) : (
                            <Badge variant="outline">
                              {p.publish_mode === "draft" ? "No (draft mode)" : "No"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
