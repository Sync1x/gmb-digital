# GMB Digital

Internal publishing dashboard for Green Mountain Broadcasters (six station WordPress sites + their Facebook pages). One place to review incoming news, pick an image, choose stations, and publish, instead of 20 browser tabs.

## Stack

- Next.js (App Router, TypeScript, Tailwind) on Vercel
- Supabase: Postgres for the drafts queue, Supabase Auth for login (email + password, small allowlist of users)
- MainWP REST API (one API key from the MainWP dashboard) for posting to all six station sites — no per-site credentials
- Confirm the exact MainWP endpoints for creating a post and setting a featured image before building Phase 2; if featured images aren't supported through MainWP, flag it rather than working around it
- Make.com: pulls newsletter emails from Zoho, splits/titles them, POSTs drafts to this app; separate Make scenarios post to Facebook and are triggered by webhook

## Build phases (do them in order, don't jump ahead)

1. **Intake + queue** — `POST /api/intake` (Make sends drafts here, protected by `x-intake-secret` header), `drafts` table, queue page listing drafts as editable cards (title, body, stations, source, status).
2. **Review + publish** — image picker (search API returns 6–8 candidates, user picks one, server converts to JPEG and uploads as featured media), station checkboxes, Publish button. Publish creates the post on each checked site, waits for WordPress to confirm (returns post ID + URL), then fires that station's Make Facebook webhook with the post ID and URL.
3. **Manual composer** — paste text + drop an image for content that arrives via Messenger; same station checkboxes and publish flow.

## Rules

- Secrets live only in `.env.local` and Vercel env vars. Never commit them. The repo may become public.
- Station config (name, site URL, Make webhook env var name) lives in one file: `src/config/stations.ts`.
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
