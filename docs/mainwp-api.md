# MainWP REST API — what we use

Source of truth: the official OpenAPI spec
(<https://raw.githubusercontent.com/mainwp/docs/main/api-reference/openapi.yaml>),
the docs overview (<https://docs.mainwp.com/api-reference/rest-api/overview>) and the
public Postman workspace "MainWP REST API v2 (Current)".

> **Live-tested on 2026-09-28** against moo92.com (MainWP site 6). See "Results".

## Auth

- API v2 only. Create a key under **MainWP Dashboard → API Access → API Keys → Add API Keys**.
  Give it the **Sites (read)** and **Posts (read + write)** permissions.
- Send it as a header on every call: `Authorization: Bearer <MAINWP_API_KEY>`
- Base URL: `${MAINWP_URL}/wp-json/mainwp/v2/`. `MAINWP_URL` is the dashboard site root,
  e.g. `https://manage.example.com`, with no trailing slash.
- The key is shown only once in MainWP and can't be viewed again.
- A key that is missing, malformed, disabled or short of permissions gets `401`.

## Endpoints

| Purpose | Method + path |
|---|---|
| List child sites | `GET /wp-json/mainwp/v2/sites/basic?per_page=100` |
| Create a post on one child site (incl. featured image) | `POST /wp-json/mainwp/v2/posts/{id_domain}/create` |
| Read one post back | `GET /wp-json/mainwp/v2/posts/{id_domain}/{id_post}` |
| Update a post (content, categories, status: this is how a draft goes live) | `PUT /wp-json/mainwp/v2/posts/{id_domain}/{id_post}/edit` |
| Change status only (**fails on drafts**, see Results) | `PUT /wp-json/mainwp/v2/posts/{id_domain}/{id_post}/update-status` |

`{id_domain}` can be the MainWP **site ID** (numeric) or the site's domain. We always
use the numeric ID, which is stored in `src/config/stations.ts`.

### sites/basic

This returns one short record per site: ID, name, URL and connection status. You can
filter it with the query params `page`, `per_page`, `search`, `include`, `exclude`, and
`status` (`any|connected|disconnected|suspended|available_update`).

### posts/{id}/create — request body (JSON)

The API requires `post_title`, `post_content`, `post_status` and `post_name`.

| Field | Notes |
|---|---|
| `post_title` | string |
| `post_content` | HTML string |
| `post_status` | `publish` \| `pending` \| `private` \| `future` \| `draft` \| `trash` |
| `post_name` | slug (required by the API; we generate it from the title) |
| `post_category` | "raw string" of categories, comma-separated. Send **slugs** (see Results) |
| `post_tags` | string |
| `post_excerpt`, `post_date`, `post_date_gmt`, `comment_status`, `ping_status`, `is_sticky`, `post_custom`, `post_password` | optional |
| **`post_featured_image`** | **"Featured image URL or data."** The child site downloads the URL into its own media library and sets it as the post thumbnail. This is the same mechanism MainWP uses for its own "Add New Post" screen (`MainWP_Child_Posts::create_featured_image`). |

**Featured images are supported natively in the create call**, so there's no separate
"set featured image" endpoint. We pass the public Supabase Storage URL of the JPEG we
generated. That URL has to be publicly reachable by every child site.

Example:

```bash
curl -X POST "$MAINWP_URL/wp-json/mainwp/v2/posts/12/create" \
  -H "Authorization: Bearer $MAINWP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "post_title": "GMB Digital test — please delete",
    "post_content": "<p>Test body</p>",
    "post_status": "draft",
    "post_name": "gmb-digital-test",
    "post_featured_image": "https://<project>.supabase.co/storage/v1/object/public/featured/test.jpg"
  }'
```

### Response shapes

- **Success envelope:** `{ "success": 1, "message"?: string, "data": ..., "total"?: n }`.
  **Watch out:** some routes return `success: 0` inside an **HTTP 200**, so the client
  checks `success`, not just the status code.
- **Error:** a standard WP REST error, `{ "code", "message", "data": { "status" } }`.
- The create call is documented as returning "its ID and permalink", but the spec doesn't
  name the fields. `src/lib/mainwp.ts` accepts `data.id | data.post_id | data.ID` and
  `data.link | data.permalink | data.url | data.post_url`. **Confirm this during the live
  test** and tighten the code.
- `sites/basic`: the client accepts `data` as either an array or an object keyed by id,
  with `id`, `name` and `url` fields.
- Some write operations can come back as a queued job (`QueuedAction`) instead of running
  inline. Single-post create isn't documented as queued, but if the live test returns a
  job ID instead of a post ID, flag it: we'd need another way to get the post URL.

## Older info you'll find online (ignore)

A 2023 community thread says "creating posts/pages is not supported by MainWP REST API".
That was true of **v1**. v2 added the Posts CRUD routes above.

## How to verify (safety: draft only, one test site)

1. `GET sites/basic`: the `/settings` page in the app does this ("Test connection").
2. Pick **one** test site ID. Create a post with `post_status: "draft"` and a
   `post_featured_image` URL.
3. Open the draft in that site's wp-admin and check the featured image is set.
4. Delete it: `PUT posts/{site}/{post}/update-status` with `{"status":"delete"}`.
5. Record here which response fields held the post ID and permalink.

## Results

Tested 2026-09-28 on moo92.com (site 6) with a throwaway draft, which was then trashed.

- **Create** returns `{"success":1,"data":{"post_id":280285,"link":"https://moo92.com/?p=280285"}}`.
  The ID is in `data.post_id`, and `data.link` is the `?p=` short link (it redirects to the permalink).
- **Get one post** returns `post_title`, `post_status`, `post_category` (comma-separated names),
  `post_featured_image` and `post_custom` (which includes `_thumbnail_id`). It has no `link` field.
- **Edit** (`PUT …/edit`) updates the title, content, categories and status, and keeps the featured image.
  On a draft it also moves `post_date` to now, so a post published later isn't backdated.
  `post_status: "publish"` publishes the draft, and `"trash"` trashes it.
- **update-status** returned `{"success":0,"message":"Update post status failed."}` when asked to trash
  a draft. Use `edit` with `post_status` instead.
- **Categories must be sent as slugs.** The child site matches `post_category` entries by slug first,
  then by name, and creates any that are missing. On Moo 92, the real "Local News" category has
  the slug `local_news`. A stray category literally named `"Local News"` (with quotes) owns the
  slug `local-news`, so sending the name `Local News` filed the post under the stray one. Sending
  `local_news` gets the right one. JJ Country has the same stray category. The app reads each
  site's categories from its public `/wp-json/wp/v2/categories` and sends slugs (`src/lib/wordpress.ts`).
- Moo 92's server sometimes closes the HTTP/2 connection (`GOAWAY`) right after a write. The write
  still goes through.
