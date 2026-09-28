import "server-only";
import { stations, type Station } from "@/config/stations";

/**
 * Reads from each station site's public WordPress REST API (no auth needed).
 * MainWP's REST API has no categories endpoint, so the category list comes
 * straight from the child sites. Cached for a few minutes.
 */

const CACHE_SECONDS = 300;

export type WpCategory = { name: string; slug: string };

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'");
}

/**
 * Names wrapped in literal quotes (e.g. `"Local News"`) are leftovers from an
 * old MainWP import, not real categories, so they're hidden.
 */
function isStray(name: string) {
  return /^["“].*["”]$/.test(name);
}

/** Categories on one station's site, sorted by name. Throws if the site can't be read. */
export async function getStationCategories(station: Station): Promise<WpCategory[]> {
  const base = station.siteUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100&_fields=name,slug`, {
    headers: { Accept: "application/json" },
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected response");

  return data
    .filter((c): c is { name: unknown; slug: unknown } => !!c && typeof c === "object")
    .map((c) => ({ name: decodeEntities(String(c.name ?? "")).trim(), slug: String(c.slug ?? "") }))
    .filter((c) => c.name && c.slug && !isStray(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Category names for every station, keyed by slug. `null` means the site couldn't be read. */
export async function getAllStationCategories(): Promise<Record<string, string[] | null>> {
  const entries = await Promise.all(
    stations.map(async (station) => {
      try {
        const categories = await getStationCategories(station);
        return [station.slug, categories.map((c) => c.name)] as const;
      } catch {
        return [station.slug, null] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

/**
 * The draft's category names that exist on this station, as that site's
 * slugs. MainWP looks categories up by slug first, and slugs are unique, so
 * this always hits the right category (names can be duplicated). Names the
 * site doesn't have are left out so no stray categories get created.
 */
export async function categorySlugsForStation(
  station: Station,
  names: string[]
): Promise<string[]> {
  if (names.length === 0) return [];
  const available = await getStationCategories(station);
  const byName = new Map(available.map((c) => [c.name.toLowerCase(), c.slug]));
  return names.map((name) => byName.get(name.toLowerCase())).filter((s): s is string => !!s);
}
