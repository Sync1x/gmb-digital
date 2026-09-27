import { stations, isConfigured, type Station } from "@/config/stations";
import { isMainwpConfigured, listSites, type MainwpSite } from "@/lib/mainwp";
import { getPublishMode, getTestSiteId } from "@/lib/publish-mode";
import { isAiEnabled } from "@/lib/ai";
import { isImageSearchConfigured } from "@/lib/image-search";
import { TestConnectionButton } from "@/components/test-connection-button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Settings · GMB Digital" };

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hostname(url: string) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

type Match =
  | { kind: "matched"; site: MainwpSite }
  | { kind: "missing"; id: string }
  | { kind: "suggested"; site: MainwpSite }
  | { kind: "none" };

function matchStation(station: Station, sites: MainwpSite[]): Match {
  if (isConfigured(station.mainwpSiteId)) {
    const site = sites.find((s) => s.id === station.mainwpSiteId);
    return site ? { kind: "matched", site } : { kind: "missing", id: station.mainwpSiteId };
  }
  const stationHost = isConfigured(station.siteUrl) ? hostname(station.siteUrl) : "";
  const byHost = stationHost && sites.find((s) => hostname(s.url) === stationHost);
  if (byHost) return { kind: "suggested", site: byHost };
  const name = normalize(station.name);
  const byName = sites.find(
    (s) => normalize(s.name).includes(name) || normalize(s.url).includes(name)
  );
  return byName ? { kind: "suggested", site: byName } : { kind: "none" };
}

function YesNo({ value, yes = "Set", no = "Not set" }: { value: boolean; yes?: string; no?: string }) {
  return <Badge variant={value ? "secondary" : "outline"}>{value ? yes : no}</Badge>;
}

export default async function SettingsPage() {
  const configured = isMainwpConfigured();
  let sites: MainwpSite[] = [];
  let connectionError: string | null = null;

  if (configured) {
    try {
      sites = await listSites();
    } catch (err) {
      connectionError = err instanceof Error ? err.message : String(err);
    }
  }

  const publishMode = getPublishMode();
  const testSiteId = getTestSiteId();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          MainWP connection, station mapping and integrations. Secrets are never shown here.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>MainWP connection</CardTitle>
            <CardDescription>
              {!configured
                ? "Not configured."
                : connectionError
                  ? "Can't connect."
                  : `Connected: ${sites.length} child site${sites.length === 1 ? "" : "s"}.`}
            </CardDescription>
          </div>
          {configured && <TestConnectionButton />}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!configured && (
            <Alert>
              <AlertTitle>MainWP isn&apos;t set up yet</AlertTitle>
              <AlertDescription>
                Add MAINWP_URL (your MainWP dashboard address) and MAINWP_API_KEY (MainWP →
                API Access → API Keys) to .env.local, then restart the app.
              </AlertDescription>
            </Alert>
          )}
          {connectionError && (
            <Alert variant="destructive">
              <AlertTitle>Connection failed</AlertTitle>
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}
          {configured && !connectionError && sites.length === 0 && (
            <p className="text-sm text-muted-foreground">MainWP returned no child sites.</p>
          )}
          {sites.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Site ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="font-mono">{site.id}</TableCell>
                    <TableCell>{site.name}</TableCell>
                    <TableCell className="text-muted-foreground">{site.url}</TableCell>
                    <TableCell>{site.status ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stations</CardTitle>
          <CardDescription>
            From src/config/stations.ts. Once you&apos;ve confirmed the matches below, copy each
            MainWP site ID into that file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Station</TableHead>
                <TableHead>MainWP site</TableHead>
                <TableHead>Facebook webhook</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((station) => {
                const match = matchStation(station, sites);
                return (
                  <TableRow key={station.slug}>
                    <TableCell>
                      <div className="font-medium">{station.name}</div>
                      <div className="text-xs text-muted-foreground">{station.slug}</div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {match.kind === "matched" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">Matched</Badge>
                          <span>
                            #{match.site.id} · {match.site.name}
                          </span>
                        </div>
                      )}
                      {match.kind === "missing" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="destructive">Not found</Badge>
                          <span>ID {match.id} isn&apos;t a MainWP site{sites.length === 0 ? " (couldn't check)" : ""}</span>
                        </div>
                      )}
                      {match.kind === "suggested" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Not set</Badge>
                          <span>
                            Suggested: #{match.site.id} · {match.site.name}
                          </span>
                        </div>
                      )}
                      {match.kind === "none" && <Badge variant="outline">Not set</Badge>}
                    </TableCell>
                    <TableCell>
                      <YesNo value={Boolean(process.env[station.makeWebhookEnvVar]?.trim())} />
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {station.makeWebhookEnvVar}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing and integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Publish mode</TableCell>
                <TableCell>
                  {publishMode === "live" ? (
                    <Badge variant="destructive">Live: posts go public and Facebook fires</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900">
                      Draft: WordPress drafts only, no Facebook
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Test site override</TableCell>
                <TableCell>
                  {testSiteId ? (
                    <span>All posts go to MainWP site #{testSiteId} (draft mode only)</span>
                  ) : (
                    <span className="text-muted-foreground">Off: each station posts to its own site</span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Image search (Brave)</TableCell>
                <TableCell>
                  <YesNo value={isImageSearchConfigured()} yes="Configured" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">AI title suggestions</TableCell>
                <TableCell>
                  <YesNo value={isAiEnabled()} yes="On" no="Off" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
