-- Scheduled publishing. Run in the Supabase SQL editor, after 0005.
-- All times are stored in UTC (timestamptz); the app displays and picks
-- them in America/New_York.

-- 1. Draft columns -----------------------------------------------------------
alter table public.drafts
  add column if not exists scheduled_for timestamptz,
  add column if not exists publish_attempts int not null default 0,
  add column if not exists last_publish_error text,
  -- When the runner claimed the draft (status 'publishing'); used to spot a
  -- run that crashed mid-way.
  add column if not exists publishing_started_at timestamptz,
  -- Set when title/body/stations/categories/image change while 'scheduled'.
  add column if not exists edited_after_scheduling boolean not null default false;

comment on column public.drafts.scheduled_for is
  'UTC time the scheduler should publish this draft. Only meaningful while status = scheduled.';
comment on column public.drafts.publish_attempts is
  'Failed scheduled-publish attempts so far. After 3 the draft becomes failed.';
comment on column public.drafts.last_publish_error is
  'Why the last scheduled publish attempt failed.';

-- 'failed' = the scheduler gave up after 3 attempts.
alter table public.drafts drop constraint if exists drafts_status_check;
alter table public.drafts
  add constraint drafts_status_check
  check (status in ('new', 'ready', 'scheduled', 'publishing', 'published', 'failed', 'discarded'));

create index if not exists drafts_due_idx
  on public.drafts (scheduled_for)
  where status = 'scheduled';

-- 2. Scheduler run log -------------------------------------------------------
create table if not exists public.scheduler_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  -- 'cron' = the Supabase/Vercel job; 'manual' = the Run now button.
  source text not null default 'cron' check (source in ('cron', 'manual')),
  -- 'live' or 'draft' (PUBLISH_MODE at the time). In draft mode "published"
  -- means saved as WordPress drafts.
  publish_mode text not null default 'draft' check (publish_mode in ('draft', 'live')),
  claimed int not null default 0,
  published int not null default 0,
  failed int not null default 0,
  late int not null default 0
);

create index if not exists scheduler_runs_ran_at_idx on public.scheduler_runs (ran_at desc);

alter table public.scheduler_runs enable row level security;

drop policy if exists "Authenticated users can read scheduler runs" on public.scheduler_runs;
create policy "Authenticated users can read scheduler runs"
  on public.scheduler_runs for select
  to authenticated
  using (true);
-- No insert/update/delete policies: only the service role (the runner) writes.

-- 3. Runner functions (service role only) --------------------------------------

-- Atomically claims due drafts: one UPDATE flips scheduled -> publishing and
-- returns the rows it changed. Two overlapping runs can never get the same row.
create or replace function public.claim_due_drafts()
returns setof public.drafts
language sql
set search_path = ''
as $$
  update public.drafts d
     set status = 'publishing',
         publishing_started_at = now()
   where d.id in (
     select id from public.drafts
      where status = 'scheduled' and scheduled_for <= now()
      order by scheduled_for
      for update skip locked
   )
     and d.status = 'scheduled'
  returning d.*;
$$;

-- A draft stuck in 'publishing' for over 15 minutes (the run crashed or timed
-- out) goes back to 'scheduled', and the interruption counts as a failed
-- attempt so a draft that always crashes the runner can't loop forever.
create or replace function public.recover_stuck_drafts()
returns int
language sql
set search_path = ''
as $$
  with fixed as (
    update public.drafts
       set publish_attempts = publish_attempts + 1,
           last_publish_error = 'Publishing was interrupted before it finished.',
           status = case when publish_attempts + 1 >= 3 then 'failed' else 'scheduled' end,
           publishing_started_at = null
     where status = 'publishing'
       and publishing_started_at < now() - interval '15 minutes'
    returning 1
  )
  select count(*)::int from fixed;
$$;

-- Logs one run and keeps only the newest 200.
create or replace function public.record_scheduler_run(
  p_source text,
  p_publish_mode text,
  p_claimed int,
  p_published int,
  p_failed int,
  p_late int
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.scheduler_runs (source, publish_mode, claimed, published, failed, late)
  values (p_source, p_publish_mode, p_claimed, p_published, p_failed, p_late);

  delete from public.scheduler_runs
   where id not in (select id from public.scheduler_runs order by ran_at desc, id desc limit 200);
end;
$$;

revoke all on function public.claim_due_drafts() from public, anon, authenticated;
revoke all on function public.recover_stuck_drafts() from public, anon, authenticated;
revoke all on function public.record_scheduler_run(text, text, int, int, int, int)
  from public, anon, authenticated;
grant execute on function public.claim_due_drafts() to service_role;
grant execute on function public.recover_stuck_drafts() to service_role;
grant execute on function public.record_scheduler_run(text, text, int, int, int, int) to service_role;
