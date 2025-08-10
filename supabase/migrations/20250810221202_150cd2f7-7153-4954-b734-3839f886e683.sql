-- Policies creation with guards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_jobs' AND policyname = 'Users can insert their own jobs'
  ) THEN
    CREATE POLICY "Users can insert their own jobs" ON public.ai_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_jobs' AND policyname = 'Users can view their own jobs'
  ) THEN
    CREATE POLICY "Users can view their own jobs" ON public.ai_jobs
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure cron job exists (drop and recreate to avoid duplicates)
DO $$
BEGIN
  PERFORM 1 FROM cron.job WHERE jobname = 'invoke-batch-jobs-every-15m';
  IF FOUND THEN
    PERFORM cron.unschedule('invoke-batch-jobs-every-15m');
  END IF;
  PERFORM cron.schedule(
    'invoke-batch-jobs-every-15m',
    '*/15 * * * *',
    $$
    select extensions.net.http_post(
      url := 'https://wwaldqgsedruplukxqdf.functions.supabase.co/functions/v1/batch-jobs',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3YWxkcWdzZWRydXBsdWt4cWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTU1MzUsImV4cCI6MjA2OTk3MTUzNX0.0E4SCTmtaoFO6CaNIh4wLQJPyJWOsPCcSrfKzi8k-K0"}'::jsonb,
      body := '{"run":true}'::jsonb
    );
    $$
  );
END $$;