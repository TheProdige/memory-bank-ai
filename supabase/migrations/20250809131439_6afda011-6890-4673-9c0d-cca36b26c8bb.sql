-- Enable required extensions (idempotent)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Remove existing job if present to avoid duplicates
select cron.unschedule('invoke-proactive-engine-15min')
where exists (
  select 1 from cron.job where jobname = 'invoke-proactive-engine-15min'
);

-- Schedule every 15 minutes
select
  cron.schedule(
    'invoke-proactive-engine-15min',
    '*/15 * * * *',
    $$
    select net.http_post(
      url := 'https://wwaldqgsedruplukxqdf.functions.supabase.co/functions/v1/proactive-engine',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3YWxkcWdzZWRydXBsdWt4cWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTU1MzUsImV4cCI6MjA2OTk3MTUzNX0.0E4SCTmtaoFO6CaNIh4wLQJPyJWOsPCcSrfKzi8k-K0"}'::jsonb,
      body := jsonb_build_object('time', now(), 'mode', 'cron')
    ) as request_id;
    $$
  );