import "server-only";

/**
 * MainWP REST API v2 client. See docs/mainwp-api.md for the endpoints and
 * response shapes. Server-only: the API key must never reach the browser.
 */

export type MainwpSite = {
  id: string;
  name: string;
  url: string;
  status: string | null;
};

export type WpPostStatus = "draft" | "publish" | "pending" | "private";

export type CreatePostInput = {
  siteId: string;
  title: string;
  /** HTML content. */
  content: string;
  status: WpPostStatus;
  /**
   * Category slugs, sent as MainWP's comma-separated raw string. Slugs, not
   * names: the child site matches by slug first, and a name can resolve to
   * the wrong category when another one owns its sanitized slug.
   */
  categories?: string[];
  /** Comments and pingbacks on the post. Closed unless this is true. */
  allowComments?: boolean;
  /** Public URL of the featured image; the child site downloads it. */
  featuredImageUrl?: string;
};

export type CreatedPost = {
  postId: string;
  postUrl: string | null;
};

export class MainwpError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "MainwpError";
  }
}

function getConfig() {
  const baseUrl = process.env.MAINWP_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.MAINWP_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw new MainwpError(
      "MainWP isn't configured: set MAINWP_URL and MAINWP_API_KEY in .env.local."
    );
  }
  return { baseUrl, apiKey };
}

export function isMainwpConfigured(): boolean {
  return Boolean(process.env.MAINWP_URL?.trim() && process.env.MAINWP_API_KEY?.trim());
}

type Envelope = {
  success?: number | boolean;
  message?: string;
  data?: unknown;
  code?: string;
};

async function request(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown
): Promise<Envelope> {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}/wp-json/mainwp/v2/${path}`;

  // Some child hosts drop the connection (HTTP/2 GOAWAY) right after a write
  // that did go through. GET and PUT are safe to repeat, so they get one retry;
  // POST (create) doesn't, since repeating it would make a duplicate post.
  const attempts = method === "POST" ? 1 : 2;
  let res: Response | null = null;
  for (let attempt = 1; !res; attempt++) {
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      if (attempt < attempts) continue;
      const reason = err instanceof Error ? err.message : String(err);
      throw new MainwpError(`Couldn't reach MainWP at ${baseUrl}: ${reason}`);
    }
  }

  const text = await res.text();
  let json: Envelope | null = null;
  try {
    json = text ? (JSON.parse(text) as Envelope) : null;
  } catch {
    // Non-JSON response (e.g. an HTML error page from a security plugin).
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new MainwpError(
        `MainWP rejected the API key (HTTP ${res.status}). Check MAINWP_API_KEY and that the key has Sites + Posts permissions.`,
        res.status
      );
    }
    if (res.status === 404) {
      throw new MainwpError(
        json?.message
          ? `MainWP: ${json.message}`
          : `MainWP endpoint not found (${path}). Is MAINWP_URL the dashboard root and is MainWP up to date?`,
        404
      );
    }
    throw new MainwpError(
      `MainWP error (HTTP ${res.status}): ${json?.message ?? text.slice(0, 200) ?? "no details"}`,
      res.status
    );
  }

  if (!json) {
    throw new MainwpError(`MainWP returned a non-JSON response for ${path}.`, res.status);
  }

  // Some routes return success: 0 inside an HTTP 200.
  if (json.success === 0 || json.success === false) {
    throw new MainwpError(`MainWP reported a failure: ${json.message ?? "no details"}`);
  }

  return json;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return null;
}

export async function listSites(): Promise<MainwpSite[]> {
  const json = await request("GET", "sites/basic?per_page=100");
  const raw = json.data;
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw)
      : [];

  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      id: str(r.id) ?? str(r.ID) ?? "",
      name: str(r.name) ?? str(r.url) ?? "(unnamed)",
      url: str(r.url) ?? "",
      status: str(r.status) ?? str(r.connection_status),
    }))
    .filter((s) => s.id);
}

/** WordPress comment_status / ping_status: closed unless comments are wanted. */
function commentFields(allow: boolean | undefined) {
  const state = allow ? "open" : "closed";
  return { comment_status: state, ping_status: state };
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post"
  );
}

/**
 * Creates a post on one child site. The featured image is set in the same
 * call via `post_featured_image` (MainWP has no separate endpoint for it).
 */
export async function createPost(input: CreatePostInput): Promise<CreatedPost> {
  const payload: Record<string, unknown> = {
    post_title: input.title,
    post_content: input.content,
    post_status: input.status,
    post_name: slugify(input.title),
    ...commentFields(input.allowComments),
  };
  if (input.categories?.length) {
    payload.post_category = input.categories.join(",");
  }
  if (input.featuredImageUrl) {
    payload.post_featured_image = input.featuredImageUrl;
  }

  const json = await request(
    "POST",
    `posts/${encodeURIComponent(input.siteId)}/create`,
    payload
  );

  const data = (json.data && typeof json.data === "object" ? json.data : {}) as Record<
    string,
    unknown
  >;
  const postId = str(data.id) ?? str(data.post_id) ?? str(data.ID);
  const postUrl =
    str(data.link) ?? str(data.permalink) ?? str(data.url) ?? str(data.post_url) ?? str(data.guid);

  if (!postId) {
    throw new MainwpError(
      `MainWP didn't return a post ID for site ${input.siteId}${json.message ? ` (${json.message})` : ""}.`
    );
  }

  return { postId, postUrl: postUrl ?? (await getPostUrl(input.siteId, postId)) };
}

export type EditPostInput = {
  siteId: string;
  postId: string;
  title: string;
  content: string;
  status: WpPostStatus;
  /** Category slugs (see CreatePostInput). */
  categories?: string[];
  allowComments?: boolean;
};

/**
 * Updates an existing post in place: content, categories and status. This is
 * how a WordPress draft goes live (MainWP's update-status call fails on
 * drafts; edit works). The featured image is kept, and a draft's date is
 * reset to now when it's published, so nothing is backdated.
 */
export async function editPost(input: EditPostInput): Promise<void> {
  const payload: Record<string, unknown> = {
    post_title: input.title,
    post_content: input.content,
    post_status: input.status,
    ...commentFields(input.allowComments),
  };
  if (input.categories?.length) {
    payload.post_category = input.categories.join(",");
  }
  await request(
    "PUT",
    `posts/${encodeURIComponent(input.siteId)}/${encodeURIComponent(input.postId)}/edit`,
    payload
  );
}

/** Reads a post back to find its permalink. Returns null rather than throwing. */
export async function getPostUrl(siteId: string, postId: string): Promise<string | null> {
  try {
    const json = await request(
      "GET",
      `posts/${encodeURIComponent(siteId)}/${encodeURIComponent(postId)}`
    );
    const data = (json.data && typeof json.data === "object" ? json.data : {}) as Record<
      string,
      unknown
    >;
    return str(data.link) ?? str(data.permalink) ?? str(data.guid) ?? str(data.url);
  } catch {
    return null;
  }
}
