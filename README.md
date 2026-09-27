# GMB Digital

The publishing dashboard for Green Mountain Broadcasters. It replaces the "20 browser tabs" routine for getting local news onto six station websites and their Facebook pages.

## What it does

1. **News comes in by itself.** A Make.com scenario reads the newsletter emails (Zoho), splits them into stories and sends each one to this app. Each story shows up in the **Queue** as a card.
2. **You review each card.** Fix the title and text, click **Find image** (web image search) or **Upload image** (file, drag and drop, or paste), and tick the stations it should go to.
3. **You click Publish.** For each ticked station, one at a time, the app:
   - creates the post on that station's WordPress site through **MainWP**, with the featured image;
   - waits for WordPress to confirm it;
   - only then triggers that station's **Make.com Facebook scenario** with the post link.
4. **Failures don't block the rest.** If one station fails, the others still go out. The failed one shows its error and a **Retry** button.
5. **New post** is for stories that arrive some other way, like Messenger: paste the text, add an image, pick stations and publish.
6. **History** lists everything published, with links to each station's post and whether Facebook was triggered.
7. **Settings** shows whether MainWP is connected, every site MainWP manages (with its ID), and which stations are set up.

Optional: **Suggest title** asks an AI (DeepSeek) for three plain, factual headlines. It's off unless you turn it on.

### Draft mode vs live mode

The `PUBLISH_MODE` setting controls whether anything goes public:

- `draft` (the default): posts are created as **WordPress drafts** and **Facebook is never triggered**. A yellow "Draft mode" badge shows at the top of every page.
- `live`: posts go public and Facebook is triggered.

Use draft mode whenever you're testing or changing something.

## Accounts you need

| Service | What it's for | What you need from it |
|---|---|---|
| **Supabase** (supabase.com) | Database (drafts, publish history), logins, image storage | Project URL, anon key, service_role key |
| **Vercel** (vercel.com) | Hosts the app | A project connected to this GitHub repo |
| **MainWP** (on GMB's MainWP dashboard site) | Posts to all six WordPress sites with one key | Dashboard URL and a REST API v2 key |
| **Make.com** | Newsletter → queue, and posting to Facebook | One scenario that POSTs to `/api/intake`, plus one webhook URL per station for Facebook |
| **Brave Search API** (api-dashboard.search.brave.com) | "Find image" search | API key. The free tier is enough to start. |
| **DeepSeek** (platform.deepseek.com), optional | "Suggest title" | API key with a little credit |
| **GitHub** | The code | Access to this repo |

## Setup, step by step

### 1. Supabase

1. Create a project (or use the existing one).
2. Open **SQL Editor**. Run each file in `supabase/migrations/` **in order**, pasting the whole file and clicking Run:
   - `0001_create_drafts.sql`
   - `0002_featured_storage_bucket.sql`
   - `0003_create_publications.sql`
3. **Authentication → Users → Add user**: create an email and password for each person who will use the app.
4. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key.

### 2. MainWP

1. On the MainWP dashboard site, go to **API Access → API Keys → Add API Keys**.
2. Give it **Sites** (read) and **Posts** (read and write) permissions.
3. Copy the key right away. MainWP only shows it once.
4. More detail is in `docs/mainwp-api.md`.

### 3. Local setup (optional, for developers)

```bash
npm install
cp .env.example .env.local   # then fill it in (see comments in the file)
npm run dev                  # http://localhost:3000
```

### 4. Environment variables

Every variable is listed and explained in `.env.example`. At minimum you need:

- the Supabase keys
- `ALLOWED_EMAILS` (the emails from step 1.3, comma-separated)
- `INTAKE_SECRET`
- `MAINWP_URL` and `MAINWP_API_KEY`

Add them to `.env.local` for local use, and to Vercel under **Project → Settings → Environment Variables**. Redeploy after changing them.

**Never commit real keys.** `.env.local` is git-ignored on purpose, because the repo may become public.

### 5. Connect the stations

1. Sign in and open **Settings**. It lists every MainWP site with its **ID**.
2. Open `src/config/stations.ts`. For each station, fill in `mainwpSiteId` (and `siteUrl`), then commit and deploy.
3. Settings will show **Matched** next to each station once it's set up.

### 6. Make.com

- **Intake scenario:** send an HTTP POST to `https://<your-app>/api/intake`.
  - Header: `x-intake-secret: <INTAKE_SECRET>`
  - JSON body: `{ "title": "...", "body": "...", "sender": "Jeff", "stations": ["magic-97-7"], "source_ref": "<email id>" }`
  - `body` and `sender` are required. `stations` uses the slugs from `stations.ts`.
- **Facebook scenarios:** one per station, each starting with a **Custom webhook**. Put each webhook URL in the matching `MAKE_WEBHOOK_*` variable.
  - The app sends `{ "post_id", "post_url", "title", "station", "station_name" }`.
  - It only sends this in live mode, and only after WordPress has confirmed the post.

### 7. Test in draft mode, then go live

1. Keep `PUBLISH_MODE=draft` and set `MAINWP_TEST_SITE_ID` to one test site's ID. Every post then goes to that one site, as a draft.
2. Publish a story. Check the draft and its featured image in that site's WordPress admin, then delete it.
3. When you're happy:
   - clear `MAINWP_TEST_SITE_ID`
   - set `PUBLISH_MODE=live` in Vercel
   - redeploy

## Troubleshooting

| Problem | Fix |
|---|---|
| Can't sign in | Is the email in `ALLOWED_EMAILS`, and does the user exist in Supabase Auth? |
| "MainWP rejected the API key" | The key is wrong, disabled or missing permissions. Create a new one. |
| A station says "has no MainWP site ID yet" | Fill in `mainwpSiteId` in `src/config/stations.ts`. |
| "Couldn't save the image… has the featured bucket migration been run?" | Run `0002_featured_storage_bucket.sql`. |
| "The post is live, but no Facebook webhook is set" | Add that station's `MAKE_WEBHOOK_*` variable, then click **Retry**. It won't create a duplicate WordPress post. |
| "Find image" says it isn't configured | Add `BRAVE_SEARCH_API_KEY`, or just upload or paste an image instead. |
