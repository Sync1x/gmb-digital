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
};

/**
 * The six Green Mountain Broadcasters station sites, with their MainWP child
 * site IDs (see /settings). Add a matching MAKE_WEBHOOK_* var to .env.local /
 * Vercel for each station's Facebook scenario.
 */
export const stations: Station[] = [
  {
    name: "Moo 92",
    slug: "moo-92",
    siteUrl: "https://moo92.com",
    mainwpSiteId: "6",
    makeWebhookEnvVar: "MAKE_WEBHOOK_MOO_92",
  },
  {
    name: "Magic 97.7",
    slug: "magic-97-7",
    siteUrl: "https://magic977.com",
    mainwpSiteId: "5",
    makeWebhookEnvVar: "MAKE_WEBHOOK_MAGIC_97_7",
  },
  {
    name: "Notch FM",
    slug: "notch-fm",
    siteUrl: "https://notchfm.com",
    mainwpSiteId: "1",
    makeWebhookEnvVar: "MAKE_WEBHOOK_NOTCH_FM",
  },
  {
    name: "JJ Country",
    slug: "jj-country",
    siteUrl: "https://jjcountry.com",
    mainwpSiteId: "3",
    makeWebhookEnvVar: "MAKE_WEBHOOK_JJ_COUNTRY",
  },
  {
    name: "KIX 105.5",
    slug: "kix-105-5",
    siteUrl: "https://kix1055.com",
    mainwpSiteId: "2",
    makeWebhookEnvVar: "MAKE_WEBHOOK_KIX_105_5",
  },
  {
    name: "WSTJ 1340",
    slug: "wstj-1340",
    siteUrl: "https://wstj1340.com",
    mainwpSiteId: "4",
    makeWebhookEnvVar: "MAKE_WEBHOOK_WSTJ_1340",
  },
];

export function getStationBySlug(slug: string): Station | undefined {
  return stations.find((station) => station.slug === slug);
}

export function isConfigured(value: string): boolean {
  return Boolean(value) && value !== "TODO";
}
