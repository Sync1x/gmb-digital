-- Supabase-side scheduler: every 5 minutes, pg_cron asks the app to publish
-- whatever is due (POST {app_url}/api/cron/publish-due with a bearer secret).
-- Run in the Supabase SQL editor, after 0006.
--
-- BEFORE the job can work, store two secrets in Supabase Vault. They are never
-- written in this file or in any SQL you run:
--
--   Dashboard -> Project Settings -> Vault (also under Integrations -> Vault)
--   -> "Add new secret", twice:
--
--     name: app_url       value: https://<your-app>.vercel.app   (no trailing slash)
--                         -> this is your APP_URL
--     name: cron_secret   value: the same string as CRON_SECRET in Vercel
--                         (generate one with:  openssl rand -hex 32)
--
-- Until both exist the job runs but fails with a clear message in
-- cron.job_run_details, and nothing is published.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

-- Reads the two secrets from Vault at run time and fires the request.
-- SECURITY DEFINER so the job can read Vault; nobody else may call it.
create or replace function public.run_publish_due()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'app_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'cron_secret' limit 1;

  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    raise exception
      'Scheduler not configured: add Vault secrets "app_url" and "cron_secret" (see 0007_scheduler_cron.sql).';
  end if;

  select net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/publish-due',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    -- A run can publish several posts to six sites; give it time to answer.
    timeout_milliseconds := 240000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.run_publish_due() from public, anon, authenticated;

-- (Re)create the job. Safe to run twice.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'publish-due') then
    perform cron.unschedule('publish-due');
  end if;
  perform cron.schedule('publish-due', '*/5 * * * *', 'select public.run_publish_due();');
end;
$$;

-- Handy checks afterwards:
--   select * from cron.job where jobname = 'publish-due';
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select * from net._http_response order by created desc limit 10;
--   select * from public.scheduler_runs order by ran_at desc limit 10;
