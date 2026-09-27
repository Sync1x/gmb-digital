export type Station = {
  /** Display name shown in the UI. */
  name: string;
  /** Stable identifier used in the drafts.stations array and as a React key. */
  slug: string;
  /** Public site URL, used to suggest the MainWP match on /settings. */
  siteUrl: string;
  /** The site's ID in MainWP (see /settings), used when posting via MainWP. */
  mainwpSiteId: string;
  /** Name of the env var holding this station's Make.com Facebook webhook URL. */
  makeWebhookEnvVar: string;
  /** WordPress category names new posts are filed under (optional). */
  wpCategories?: string[];
};

/**
 * The six Green Mountain Broadcasters station sites. Open /settings to see
 * every MainWP child site and its ID, then fill in mainwpSiteId and siteUrl
 * here. Add a matching MAKE_WEBHOOK_* var to .env.local / Vercel for each.
 */
export const stations: Station[] = [
  {
    name: "Moo 92",
    slug: "moo-92",
    siteUrl: "TODO",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_MOO_92",
  },
  {
    name: "Magic 97.7",
    slug: "magic-97-7",
    siteUrl: "TODO",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_MAGIC_97_7",
  },
  {
    name: "Notch FM",
    slug: "notch-fm",
    siteUrl: "TODO",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_NOTCH_FM",
  },
  {
    name: "Station 4",
    slug: "station-4",
    siteUrl: "TODO",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_STATION_4",
  },
  {
    name: "Station 5",
    slug: "station-5",
    siteUrl: "TODO",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_STATION_5",
  },
  {
    name: "Station 6",
    slug: "station-6",
    siteUrl: "TODO",
    mainwpSiteId: "TODO",
    makeWebhookEnvVar: "MAKE_WEBHOOK_STATION_6",
  },
];

export function getStationBySlug(slug: string): Station | undefined {
  return stations.find((station) => station.slug === slug);
}

export function isConfigured(value: string): boolean {
  return Boolean(value) && value !== "TODO";
}
