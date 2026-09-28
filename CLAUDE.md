# GMB Digital

Internal publishing dashboard for Green Mountain Broadcasters (six station WordPress sites + their Facebook pages). One place to review incoming news, pick an image, choose stations, and publish, instead of 20 browser tabs.

## Stack

- Next.js (App Router, TypeScript, Tailwind) on Vercel
- Supabase: Postgres for the drafts queue, Supabase Auth for login (email + password, small allowlist of users)
- MainWP REST API (one API key from the MainWP dashboard) for posting to all six station sites — no per-site credentials
- MainWP endpoints and request shapes are documented in `docs/mainwp-api.md`. The featured image is set in the create-post call itself (`post_featured_image` = a public image URL the child site downloads).
- Make.com: pulls newsletter emails from Zoho, splits/titles them, POSTs drafts to this app; separate Make scenarios post to Facebook and are triggered by webhook
- Brave Search API for image search; sharp for JPEG conversion; Supabase Storage (public bucket `featured`) for images
- DeepSeek (optional) for title suggestions

## Status

Phases 1–3 are built, plus WordPress categories and an Approve & publish flow. The MainWP live test is done: see "Results" in `docs/mainwp-api.md`.

## Where things live

- `src/app/(app)/`: signed-in pages sharing the shadcn sidebar layout (`components/app-sidebar.tsx`, `site-header.tsx`, `page-header.tsx`). Font is Inter.
  - `page.tsx` is the queue: draft cards with a status filter
  - `new/` is the manual composer (Phase 3)
  - `history/` lists published posts
  - `settings/` shows the MainWP connection, child site IDs and station mapping
- `src/app/login`, `src/app/auth/logout`: auth. `src/proxy.ts` (Next 16's renamed middleware) guards everything except `/login` and `/api/intake`.
- `src/app/api/intake`: Make.com → drafts (`x-intake-secret`). `src/app/api/images/upload` handles image uploads. It's a route handler because server actions cap bodies at 1 MB.
- Server actions: `src/app/actions.ts` (drafts), `image-actions.ts`, `publish-actions.ts`, `ai-actions.ts`. They return `ActionResult` (`{ ok, data } | { ok, error }`) instead of throwing, because production Next hides thrown messages.
- `src/lib/wordpress.ts`: reads each station's categories from its public WP REST API (MainWP has no categories endpoint) and maps category names to that site's slugs for publishing.
- `src/lib/mainwp.ts`: MainWP client. `publish.ts` holds the per-station publish logic (WordPress first, then Facebook). `publish-mode.ts` covers PUBLISH_MODE and MAINWP_TEST_SITE_ID. `image-search.ts` is the swappable provider interface (Brave today). `images.ts` handles download, sharp and Storage. `ai.ts` covers DeepSeek plus the AI_ENABLED check.
- `supabase/migrations/`: SQL run by hand in the Supabase SQL editor, in order:
  - `0001` creates drafts
  - `0002` creates the `featured` bucket
  - `0003` creates publications
  - `0004` pins `set_updated_at()`'s search_path (Supabase security advisor)
  - `0005` adds `drafts.categories` (WordPress category names)
- Publishing runs from the browser: one `publishStationAction(draftId, slug, target)` per station in sequence, then `finalizeDraftAction(draftId, target)`. `target` is `"draft"` (Save as WordPress draft: draft status becomes `ready`) or `"live"` (Approve & publish: becomes `published` once every station is live and Facebook has fired).
- One WP post per station per draft: an existing WordPress draft is updated in place with MainWP's `edit` call (which also publishes it; `update-status` fails on drafts). An already-live post is left alone and only Facebook is retried. The featured image is only set at creation; `edit` can't change it.
- Categories are sent to MainWP as that site's **slugs**, never names: the child site matches by slug first, and on Moo 92 / JJ Country a stray category named `"Local News"` (with quotes) owns the `local-news` slug.
- `PUBLISH_MODE` is the master switch. It defaults to `draft`, which disables the live buttons (WP drafts only, no Facebook). Only `PUBLISH_MODE=live` allows Approve & publish.

## Build phases (do them in order, don't jump ahead)

1. **Intake + queue** — `POST /api/intake` (Make sends drafts here, protected by `x-intake-secret` header), `drafts` table, queue page listing drafts as editable cards (title, body, stations, source, status).
2. **Review + publish** — image picker (search API returns 6–8 candidates, user picks one, server converts to JPEG and uploads as featured media), station checkboxes, Publish button. Publish creates the post on each checked site, waits for WordPress to confirm (returns post ID + URL), then fires that station's Make Facebook webhook with the post ID and URL.
3. **Manual composer** — paste text + drop an image for content that arrives via Messenger; same station checkboxes and publish flow.

## Rules

- Secrets live only in `.env.local` and Vercel env vars. Never commit them. The repo may become public.
- Station config (name, site URL, MainWP site ID, Make webhook env var name) lives in one file: `src/config/stations.ts`.
- While building or testing, never publish to a live station: keep `PUBLISH_MODE=draft` locally and set `MAINWP_TEST_SITE_ID` to one test site. Never print API keys in the terminal or logs.
- Tailwind's `dark:` variant is bound to a `.dark` class that is never applied (see `globals.css`), so shadcn's `dark:` classes stay inert.
- Every draft keeps its source (sender / email / manual) and status (`new` → `ready` → `published` / `discarded`).
- Publishing must never fire the Facebook webhook until WordPress has returned a successful response for that site.
- AI steps (splitting, titles, image queries) must be optional and switchable off, so the tool still works without AI.
- Keep the UI plain and fast: one queue page, big clear buttons, works on a laptop screen.
- Use shadcn/ui components for everything (Card, Button, Input, Textarea, Checkbox, Badge, Dialog, Sonner for toasts, etc.). Don't hand-roll components that shadcn already has.
- Light theme only: white background, neutral grays, no dark mode, no theme toggle. Dark theme CSS variables are removed, not just unused.
- Clean and plain: generous spacing, clear labels, big obvious primary buttons.

## Newsletter sender → station routing

- Michael → Moo 92 (ignore his image-only email)
- Jeff → Magic 97.7
- John → Notch FM (sends a .docx with several untitled stories)
- Bill Sayre → Notch FM

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
