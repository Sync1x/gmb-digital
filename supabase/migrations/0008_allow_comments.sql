-- Per-draft switch for WordPress comments. Off by default: GMB posts don't take
-- comments, so every existing and new draft publishes with comments (and
-- pingbacks) closed unless someone turns the toggle on.
alter table public.drafts
  add column if not exists allow_comments boolean not null default false;

comment on column public.drafts.allow_comments is
  'When false (default) the post is published with comment_status and ping_status closed.';
