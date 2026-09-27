-- Drafts queue: newsletter/manual content awaiting review and publish.
-- Paste this into the Supabase SQL editor and run it. Not run by the app.

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text,
  body text not null,

  source_type text not null check (source_type in ('newsletter', 'manual')),
  source_sender text,
  source_ref text,

  stations text[] not null default '{}',

  status text not null default 'new'
    check (status in ('new', 'ready', 'published', 'discarded')),

  featured_image_url text
);

comment on table public.drafts is
  'Incoming news items (from Make.com or manual entry) queued for review and publishing to station sites.';
comment on column public.drafts.source_ref is
  'Reference back to the source: e.g. the source email id, or a free-text note for manual entries.';
comment on column public.drafts.stations is
  'Station slugs (see src/config/stations.ts) this draft is/was published to.';

-- Keep updated_at current on every row update.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_drafts_updated_at on public.drafts;
create trigger set_drafts_updated_at
  before update on public.drafts
  for each row
  execute function public.set_updated_at();

-- Row-level security: only logged-in (authenticated) users can read or
-- write drafts. The /api/intake route uses the service-role key, which
-- bypasses RLS entirely, so Make.com's inserts are unaffected by this.
alter table public.drafts enable row level security;

drop policy if exists "Authenticated users can read drafts" on public.drafts;
create policy "Authenticated users can read drafts"
  on public.drafts for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert drafts" on public.drafts;
create policy "Authenticated users can insert drafts"
  on public.drafts for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update drafts" on public.drafts;
create policy "Authenticated users can update drafts"
  on public.drafts for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete drafts" on public.drafts;
create policy "Authenticated users can delete drafts"
  on public.drafts for delete
  to authenticated
  using (true);

create index if not exists drafts_created_at_idx on public.drafts (created_at desc);
create index if not exists drafts_status_idx on public.drafts (status);
