-- One row per (draft, station): the result of posting that draft to that
-- station's WordPress site via MainWP, and whether its Facebook (Make.com)
-- webhook has fired. Retrying a station updates its existing row.

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts (id) on delete cascade,
  station_slug text not null,
  mainwp_site_id text,
  wp_post_id text,
  post_url text,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'failed')),
  error text,
  facebook_triggered_at timestamptz,
  -- 'draft' = created as a WordPress draft while PUBLISH_MODE=draft (no Facebook).
  publish_mode text not null default 'draft'
    check (publish_mode in ('draft', 'live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, station_slug)
);

create index if not exists publications_created_at_idx
  on public.publications (created_at desc);
create index if not exists publications_status_idx
  on public.publications (status);

-- Reuses the set_updated_at() function from 0001_create_drafts.sql.
drop trigger if exists publications_set_updated_at on public.publications;
create trigger publications_set_updated_at
  before update on public.publications
  for each row execute function public.set_updated_at();

alter table public.publications enable row level security;

drop policy if exists "Authenticated users can read publications" on public.publications;
create policy "Authenticated users can read publications"
  on public.publications for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert publications" on public.publications;
create policy "Authenticated users can insert publications"
  on public.publications for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update publications" on public.publications;
create policy "Authenticated users can update publications"
  on public.publications for update
  to authenticated
  using (true)
  with check (true);
