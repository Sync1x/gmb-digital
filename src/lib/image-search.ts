import "server-only";

export type ImageResult = {
  /** Full-size image URL; this is what gets downloaded when picked. */
  imageUrl: string;
  /** Small preview for the grid. */
  thumbnailUrl: string;
  /** Domain the image was found on, e.g. "vtdigger.org". */
  sourceDomain: string;
  /** Page the image appears on. */
  pageUrl: string | null;
  title: string;
  width: number | null;
  height: number | null;
};

/** Swap providers by implementing this and changing `getProvider()`. */
export interface ImageSearchProvider {
  readonly name: string;
  isConfigured(): boolean;
  search(query: string, count: number): Promise<ImageResult[]>;
}

type BraveImageResult = {
  title?: string;
  url?: string;
  source?: string;
  thumbnail?: { src?: string; width?: number; height?: number };
  properties?: { url?: string; placeholder?: string; width?: number; height?: number };
  meta_url?: { hostname?: string };
};

class BraveImageSearch implements ImageSearchProvider {
  readonly name = "Brave Search";

  private get apiKey() {
    return process.env.BRAVE_SEARCH_API_KEY?.trim();
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async search(query: string, count: number): Promise<ImageResult[]> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      throw new Error("Image search isn't configured: set BRAVE_SEARCH_API_KEY in .env.local.");
    }

    const params = new URLSearchParams({
      q: query,
      // Ask for extra results: some get dropped below for missing URLs.
      count: String(Math.min(count * 2, 50)),
      safesearch: "strict",
      country: "us",
      search_lang: "en",
    });

    const res = await fetch(`https://api.search.brave.com/res/v1/images/search?${params}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Brave rejected the API key. Check BRAVE_SEARCH_API_KEY.");
    }
    if (res.status === 429) {
      throw new Error("Brave image search rate limit hit. Wait a moment and try again.");
    }
    if (!res.ok) {
      throw new Error(`Brave image search failed (HTTP ${res.status}).`);
    }

    const json = (await res.json()) as { results?: BraveImageResult[] };

    return (json.results ?? [])
      .map((r): ImageResult | null => {
        const imageUrl = r.properties?.url;
        const thumbnailUrl = r.thumbnail?.src ?? imageUrl;
        if (!imageUrl || !thumbnailUrl) return null;
        let sourceDomain = r.meta_url?.hostname ?? r.source ?? "";
        if (!sourceDomain && r.url) {
          try {
            sourceDomain = new URL(r.url).hostname;
          } catch {}
        }
        return {
          imageUrl,
          thumbnailUrl,
          sourceDomain: sourceDomain.replace(/^www\./, ""),
          pageUrl: r.url ?? null,
          title: r.title ?? "",
          width: r.properties?.width ?? null,
          height: r.properties?.height ?? null,
        };
      })
      .filter((r): r is ImageResult => r !== null)
      .slice(0, count);
  }
}

function getProvider(): ImageSearchProvider {
  return new BraveImageSearch();
}

export function isImageSearchConfigured(): boolean {
  return getProvider().isConfigured();
}

export async function searchImages(query: string, count = 8): Promise<ImageResult[]> {
  return getProvider().search(query, count);
}
