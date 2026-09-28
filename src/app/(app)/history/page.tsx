/* eslint-disable @next/next/no-img-element -- Supabase Storage URLs */
import { ExternalLinkIcon, HistoryIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getStationBySlug } from "@/config/stations";
import type { Draft, Publication } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  draft: Pick<
    Draft,
    "id" | "title" | "featured_image_url" | "source_type" | "source_sender"
  > | null;
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
      <PageHeader
        title="History"
        description="Everything posted to the station sites, newest first."
      />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load history</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {!error && groups.length === 0 && (
        <EmptyState
          title="Nothing published yet"
          description="Once you publish a story from the queue or New post, it shows up here with links to each station's post."
          action={{ href: "/", label: "Go to the queue" }}
          icon={HistoryIcon}
        />
      )}

      <ul className="flex flex-col gap-4" aria-label="Published stories">
        {groups.map(({ draft, pubs, latest }) => (
          <li key={draft.id}>
            <Card>
              <CardContent className="flex flex-col gap-5 sm:flex-row">
                {draft.featured_image_url && (
                  <img
                    src={draft.featured_image_url}
                    alt=""
                    className="aspect-video w-full rounded-lg border object-cover sm:w-40 sm:self-start"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold leading-snug">
                      {draft.title || "Untitled"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={latest}>
                        {new Date(latest).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>{" "}
                      · {draft.source_type === "newsletter" ? "Newsletter" : "Manual"}
                      {draft.source_sender ? ` · ${draft.source_sender}` : ""}
                    </p>
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
                                  className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                                >
                                  View post{" "}
                                  <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                                  <span className="sr-only">(opens in a new tab)</span>
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
          </li>
        ))}
      </ul>
    </>
  );
}
