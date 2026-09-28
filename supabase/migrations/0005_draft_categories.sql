-- WordPress category names chosen for a draft (e.g. "Local News", "NEK Events").
-- At publish time each station only gets the names that exist on its own site.
alter table public.drafts
  add column if not exists categories text[] not null default '{}';

comment on column public.drafts.categories is
  'WordPress category names. Each station receives only the ones that exist on that site.';
