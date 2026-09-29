# GMB Digital

The publishing dashboard for Green Mountain Broadcasters. It replaces the "20 browser tabs" routine for getting local news onto six station websites and their Facebook pages.

## What it does

1. **News comes in by itself.** A Make.com scenario reads the newsletter emails (Zoho), splits them into stories and sends each one to this app. Each story shows up in the **Queue** as a card.
2. **You review each card.** Fix the title and text, click **Find image** (web image search) or **Upload image** (file, drag and drop, or paste), tick the stations, then pick **Categories** (e.g. Local News, NEK Events). The category list comes from the ticked stations' own sites; each station only gets the categories it has.
3. **Two ways to send it:**
   - **Save as WordPress draft**: creates a draft on each ticked site. Nothing goes public and Facebook isn't triggered. The card stays in the queue marked "In WordPress as draft".
   - **Approve & publish**: for each ticked station, one at a time, the app publishes the post through **MainWP** (an existing WordPress draft is updated and published, so there are no duplicates), waits for WordPress to confirm it, and only then triggers that station's **Make.com Facebook scenario** with the post link.
   - **Schedule**: pick a date and time (Eastern) and the app publishes it for you, exactly like Approve & publish. See "Scheduled publishing" below.
4. **Failures don't block the rest.** If one station fails, the others still go out. The failed one shows its error and a **Retry** button.
5. **New post** is for stories that arrive some other way, like Messenger: paste the text, add an image, pick stations and categories, then **Publish now**, **Save as WordPress draft**, or **Save to queue** to finish later.
6. **History** lists everything published, with links to each station's post and whether Facebook was triggered.
7. **Settings** shows whether MainWP is connected, every site MainWP manages (with its ID), and which stations are set up.

Optional: **Suggest title** asks an AI (DeepSeek) for three plain, factual headlines. It's off unless you turn it on.

### The live-publishing switch

`PUBLISH_MODE` is a master switch over the buttons above:

- `live`: **Approve & publish** and **Publish now** work. Set this in Vercel for the real app.
- `draft` (the default): those buttons are turned off, so everything can only be saved as a **WordPress draft** and **Facebook is never triggered**. A yellow "Drafts only" badge shows at the top of every page.

Keep `draft` on your own computer and whenever you're testing or changing something.

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
   - `0004_pin_set_updated_at_search_path.sql`
   - `0005_draft_categories.sql`
   - `0006_scheduled_publishing.sql`
   - `0007_scheduler_cron.sql` (only after adding the two Vault secrets, see "Scheduled publishing")
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
- `CRON_SECRET` and `APP_URL` (for scheduled publishing)

Add them to `.env.local` for local use, and to Vercel under **Project → Settings → Environment Variables**. Redeploy after changing them.

**Never commit real keys.** `.env.local` is git-ignored on purpose, because the repo may become public.

### 5. Connect the stations

The six stations are already mapped in `src/config/stations.ts` (Moo 92 → 6, Magic 97.7 → 5, Notch FM → 1, JJ Country → 3, KIX 105.5 → 2, WSTJ 1340 → 4). **Settings** shows **Matched** next to each one. If a site is ever re-added to MainWP and gets a new ID, update that file, then commit and deploy.

### 6. Make.com

- **Intake scenario:** send an HTTP POST to `https://<your-app>/api/intake`.
  - Header: `x-intake-secret: <INTAKE_SECRET>`
  - JSON body: `{ "title": "...", "body": "...", "sender": "Jeff", "stations": ["magic-97-7"], "categories": ["Local News"], "source_ref": "<email id>" }`
  - `body` and `sender` are required. `stations` uses the slugs from `stations.ts`. `categories` (optional) uses WordPress category names.
  - Stories from Make always land in the queue as drafts in this app. Nothing reaches WordPress until someone approves it.
- **Facebook scenarios:** one per station, each starting with a **Custom webhook**. Put each webhook URL in the matching `MAKE_WEBHOOK_*` variable.
  - The app sends `{ "post_id", "post_url", "title", "station", "station_name" }`.
  - It only sends this when a post goes live, and only after WordPress has confirmed it.

### 7. Test in draft mode, then go live

1. Keep `PUBLISH_MODE=draft` and set `MAINWP_TEST_SITE_ID` to one test site's ID. Every post then goes to that one site, as a draft.
2. Click **Save as WordPress draft** on a story. Check the draft, its categories and featured image in that site's WordPress admin, then delete it.
3. When you're happy:
   - clear `MAINWP_TEST_SITE_ID`
   - set `PUBLISH_MODE=live` in Vercel
   - redeploy

## Scheduled publishing

**Schedule** (next to Approve & publish, on queue cards and on New post) sends a story out later. Pick a date, a time in 15-minute steps, or a quick pick ("In 1 hour", "Tomorrow 6:00 AM", "Tomorrow 10:00 AM", "Monday 6:00 AM"). The dialog spells out what will happen, for example "Goes out Tue Sep 29 at 6:00 AM to Notch FM, Magic 97.7".

- All times are **Eastern (New York)**, including around daylight saving changes. A time skipped by the spring clock change is rejected; a time repeated in the fall uses the first one. They are stored in UTC.
- It needs a title, a story, an image and at least one station, and must be **at least 5 minutes ahead**.
- A scheduled card shows its time and a countdown. **Reschedule**, **Unschedule** (back to Ready) and **Publish now** are on the card. Editing keeps it scheduled and adds an "Edited after scheduling" note; what goes out is the latest saved version.
- The **Scheduled** filter (and the count under Queue in the sidebar) lists them soonest first, grouped by day.
- The scheduler checks every **5 minutes**, so a post can go out up to about 5 minutes after its time.
- If a scheduled post fails it is retried 5 minutes later, up to 3 attempts. After that it shows as a red alert at the top of the queue with **Retry now** and **Reschedule**.
- It respects the live switch: with `PUBLISH_MODE` not `live` a scheduled post is only saved as WordPress drafts (and ends up **Ready**, not Published), and Facebook isn't triggered.

### How it runs

A **Supabase cron job** (pg_cron) calls `POST /api/cron/publish-due` every 5 minutes with a secret. Vercel's free plan only allows daily cron jobs, which is why the job lives in Supabase.

1. In Vercel add `CRON_SECRET` (generate one with `openssl rand -hex 32`) and `APP_URL` (e.g. `https://gmb-digital.vercel.app`, no trailing slash). Redeploy.
2. In Supabase open **Project Settings → Vault → Add new secret** and add two secrets:
   - `app_url`: the same value as `APP_URL`
   - `cron_secret`: the same value as `CRON_SECRET`
3. In the SQL Editor run `0006_scheduled_publishing.sql`, then `0007_scheduler_cron.sql`.
4. Open **Settings → Scheduler** in the app. Within 5 minutes it should say "Looks healthy". **Run now** runs the scheduler once by hand. Supabase's `cron.job_run_details` table shows why the job failed if it doesn't.

`/settings` warns when no scheduled run has happened for 15 minutes.

### Option: Vercel Pro

If the project moves to Vercel Pro you can let Vercel call the endpoint instead of Supabase. Copy `docs/vercel-cron.json` to `vercel.json` in the project root and deploy (Vercel sends `Authorization: Bearer $CRON_SECRET` automatically). It isn't active now because the Hobby plan rejects a cron more frequent than daily and would fail the deploy. If you switch, remove the Supabase job so it doesn't run twice:

```sql
select cron.unschedule('publish-due');
```

(Running twice can't double-publish, because a due post can only be claimed once.)

## Troubleshooting

| Problem | Fix |
|---|---|
| Can't sign in | Is the email in `ALLOWED_EMAILS`, and does the user exist in Supabase Auth? |
| "MainWP rejected the API key" | The key is wrong, disabled or missing permissions. Create a new one. |
| A station says "has no MainWP site ID yet" | Fill in `mainwpSiteId` in `src/config/stations.ts`. |
| "Couldn't save the image… has the featured bucket migration been run?" | Run `0002_featured_storage_bucket.sql`. |
| "The post is live, but no Facebook webhook is set" | Add that station's `MAKE_WEBHOOK_*` variable, then click **Retry**. It won't create a duplicate WordPress post. |
| Scheduled posts don't go out / Settings says "No run in over 15 minutes" | The Supabase job isn't calling the app. Check the Vault secrets `app_url` and `cron_secret`, that `CRON_SECRET` in Vercel matches, and `select * from cron.job_run_details order by start_time desc limit 10;` |
| "Find image" says it isn't configured | Add `BRAVE_SEARCH_API_KEY`, or just upload or paste an image instead. |
