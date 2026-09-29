import { createClient } from "@/lib/supabase/server";
import { formatWhen } from "@/lib/schedule-time";
import { isLiveEnabled } from "@/lib/publish-mode";
import type { SchedulerRun } from "@/lib/types";
import { RelativeTime } from "@/components/scheduled-badge";
import { RunSchedulerButton } from "@/components/run-scheduler-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** No cron run in this long = the job probably isn't running. */
const STALE_AFTER_MS = 15 * 60 * 1000;
/** A scheduled draft still waiting this long after its time = the scheduler is behind. */
const OVERDUE_AFTER_MS = 10 * 60 * 1000;

// Server component: the clock is read once per request.
const currentTime = () => Date.now();

function resultText(run: SchedulerRun) {
  if (run.claimed === 0) return "Nothing was due";
  const parts = [`claimed ${run.claimed}`, `published ${run.published}`, `failed ${run.failed}`];
  if (run.late > 0) parts.push(`late ${run.late}`);
  return parts.join(", ");
}

export async function SchedulerCard() {
  const supabase = await createClient();
  const [{ data: runRows, error: runError }, { data: waitingRows }] = await Promise.all([
    supabase.from("scheduler_runs").select("*").order("ran_at", { ascending: false }).limit(8),
    supabase
      .from("drafts")
      .select("scheduled_for")
      .eq("status", "scheduled")
      .order("scheduled_for", { ascending: true }),
  ]);

  const runs = (runRows ?? []) as SchedulerRun[];
  const lastCron = runs.find((r) => r.source === "cron") ?? null;
  const waiting = (waitingRows ?? []) as { scheduled_for: string | null }[];
  const now = currentTime();
  const overdue = waiting.filter(
    (w) => w.scheduled_for && now - new Date(w.scheduled_for).getTime() > OVERDUE_AFTER_MS
  ).length;
  const next = waiting.find((w) => w.scheduled_for)?.scheduled_for ?? null;

  const health: "healthy" | "stale" | "never" = !lastCron
    ? "never"
    : now - new Date(lastCron.ran_at).getTime() > STALE_AFTER_MS
      ? "stale"
      : "healthy";

  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
  const secretSet = Boolean(process.env.CRON_SECRET?.trim());

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Scheduler</CardTitle>
          <CardDescription>
            Publishes scheduled posts. A Supabase job calls the app every 5 minutes.
          </CardDescription>
        </div>
        <RunSchedulerButton />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {runError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t read the scheduler log</AlertTitle>
            <AlertDescription>
              {runError.message}. Run migration 0006 in the Supabase SQL editor.
            </AlertDescription>
          </Alert>
        ) : health === "healthy" ? (
          <Alert>
            <AlertTitle>Looks healthy</AlertTitle>
            <AlertDescription>
              The last scheduled run was <RelativeTime iso={lastCron!.ran_at} />.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>
              {health === "never" ? "No scheduled run recorded yet" : "No run in over 15 minutes"}
            </AlertTitle>
            <AlertDescription>
              {health === "stale" && lastCron && (
                <>
                  The last run was <RelativeTime iso={lastCron.ran_at} />.{" "}
                </>
              )}
              Scheduled posts won&apos;t go out until the job runs. Check that migration 0007 was
              run, that the Vault secrets <code>app_url</code> and <code>cron_secret</code> exist,
              and <code>cron.job_run_details</code> in Supabase for errors.
            </AlertDescription>
          </Alert>
        )}

        {overdue > 0 && (
          <Alert variant="destructive">
            <AlertTitle>
              {overdue} scheduled post{overdue === 1 ? " is" : "s are"} overdue
            </AlertTitle>
            <AlertDescription>
              They were due more than 10 minutes ago and haven&apos;t gone out. Use Run now to
              publish them.
            </AlertDescription>
          </Alert>
        )}

        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Last scheduled run</TableCell>
              <TableCell>
                {lastCron ? (
                  <>
                    <RelativeTime iso={lastCron.ran_at} />
                    <span className="text-muted-foreground"> · {formatWhen(new Date(lastCron.ran_at))} ET</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Result of that run</TableCell>
              <TableCell>{lastCron ? resultText(lastCron) : "—"}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Waiting</TableCell>
              <TableCell>
                {waiting.length === 0
                  ? "Nothing scheduled"
                  : `${waiting.length} scheduled${next ? `, next ${formatWhen(new Date(next))} ET` : ""}`}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">When it runs</TableCell>
              <TableCell>
                {isLiveEnabled() ? (
                  "Live: posts go public and Facebook fires"
                ) : (
                  <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">
                    Draft mode: only saves WordPress drafts (PUBLISH_MODE isn&apos;t live)
                  </Badge>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Endpoint</TableCell>
              <TableCell className="whitespace-normal">
                <code className="text-xs">{appUrl ? `${appUrl}/api/cron/publish-due` : "APP_URL not set"}</code>
                <div className="mt-1 text-xs text-muted-foreground">
                  CRON_SECRET: {secretSet ? "set" : "not set (the endpoint rejects every call)"}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {runs.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Recent runs</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <RelativeTime iso={run.ran_at} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {run.source === "cron" ? "Scheduler" : "Run now"}
                    </TableCell>
                    <TableCell>
                      {resultText(run)}
                      {run.publish_mode === "draft" && run.claimed > 0 && (
                        <span className="text-muted-foreground"> (WordPress drafts)</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
