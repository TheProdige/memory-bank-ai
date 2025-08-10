-- Enable required extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Trigger function for updated_at (reuse if exists)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- AI jobs table for batching non-urgent tasks (e.g., embeddings)
create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('embed')),
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','processing','done','error')),
  scheduled_for timestamptz not null default now(),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_jobs enable row level security;

-- Policies: users can insert and view their own jobs; service role bypasses for batch processor
create policy if not exists "Users can insert their own jobs" on public.ai_jobs
for insert with check (auth.uid() = user_id);

create policy if not exists "Users can view their own jobs" on public.ai_jobs
for select using (auth.uid() = user_id);

-- Indexes for scheduler
create index if not exists idx_ai_jobs_status_scheduled on public.ai_jobs (status, scheduled_for);
create index if not exists idx_ai_jobs_user on public.ai_jobs (user_id);

-- updated_at trigger
create or replace trigger trg_ai_jobs_updated_at
before update on public.ai_jobs
for each row execute function public.update_updated_at_column();

-- Ensure llm_budgets is updated when ai_logs receives inserts
-- Create trigger only if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_logs_increment_budget'
  ) THEN
    CREATE TRIGGER trg_ai_logs_increment_budget
    AFTER INSERT ON public.ai_logs
    FOR EACH ROW EXECUTE FUNCTION public.increment_budget_on_ai_logs();
  END IF;
END $$;

-- Schedule cron to invoke the batch-jobs edge function every 15 minutes
-- Note: This requires pg_cron and pg_net extensions enabled
select
  cron.schedule(
    'invoke-batch-jobs-every-15m',
    '*/15 * * * *',
    $$
    select net.http_post(
      url := 'https://wwaldqgsedruplukxqdf.functions.supabase.co/functions/v1/batch-jobs',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3YWxkcWdzZWRydXBsdWt4cWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTU1MzUsImV4cCI6MjA2OTk3MTUzNX0.0E4SCTmtaoFO6CaNIh4wLQJPyJWOsPCcSrfKzi8k-K0"}'::jsonb,
      body := '{"run":true}'::jsonb
    );
    $$
  );