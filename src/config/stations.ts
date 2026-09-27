export type Station = {
  /** Display name shown in the UI. */
  name: string;
  /** Stable identifier used in the drafts.stations array and as a React key. */
  slug: string;
  /** The site's ID in MainWP, used when posting via the MainWP REST API. */
  mainwpSiteId: string;
  /** Name of the env var holding this station's Make.com Facebook webhook URL. */
  makeWebhookEnvVar: string;
};

/**
 * The six Green Mountain Broadcasters station sites. Fill in the real
 * mainwpSiteId for each once confirmed in the MainWP dashboard, and add
 * a matching MAKE_WEBHOOK_* var to .env.local / Vercel for each station.
 */
export const stations: Station[] = [
  {
    name: "Moo 92",
    slug: "moo-92",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_MOO_92",
  },
  {
    name: "Magic 97.7",
    slug: "magic-97-7",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_MAGIC_97_7",
  },
  {
    name: "Notch FM",
    slug: "notch-fm",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_NOTCH_FM",
  },
  {
    name: "Station 4",
    slug: "station-4",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_STATION_4",
  },
  {
    name: "Station 5",
    slug: "station-5",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_STATION_5",
  },
  {
    name: "Station 6",
    slug: "station-6",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_STATION_6",
  },
];

export function getStationBySlug(slug: string): Station | undefined {
  return stations.find((station) => station.slug === slug);
}
