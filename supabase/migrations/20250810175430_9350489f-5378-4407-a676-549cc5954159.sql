-- Create budgets table and supporting indexes/triggers, plus performance indexes and dedup columns

-- 1) LLM budgets table
CREATE TABLE IF NOT EXISTS public.llm_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT ((now() at time zone 'utc')::date),
  daily_limit_usd numeric NOT NULL DEFAULT 0.50,
  spent_usd numeric NOT NULL DEFAULT 0,
  spent_tokens_in integer NOT NULL DEFAULT 0,
  spent_tokens_out integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT llm_budgets_user_date_uniq UNIQUE (user_id, date)
);

ALTER TABLE public.llm_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own llm_budgets"
ON public.llm_budgets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own llm_budgets"
ON public.llm_budgets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own llm_budgets"
ON public.llm_budgets FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger to maintain updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_llm_budgets_updated_at'
  ) THEN
    CREATE TRIGGER trg_llm_budgets_updated_at
    BEFORE UPDATE ON public.llm_budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Add request_fingerprint to ai_logs if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ai_logs' AND column_name = 'request_fingerprint'
  ) THEN
    ALTER TABLE public.ai_logs ADD COLUMN request_fingerprint text;
  END IF;
END $$;

-- 3) Indexes for cache/logs performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_cache_user_key ON public.ai_cache(user_id, key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON public.ai_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created ON public.ai_logs(user_id, created_at);

-- 4) Add content_hash to memory_chunks for dedup and unique per user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'memory_chunks' AND column_name = 'content_hash'
  ) THEN
    ALTER TABLE public.memory_chunks ADD COLUMN content_hash text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_chunks_user_hash 
  ON public.memory_chunks(user_id, content_hash) WHERE content_hash IS NOT NULL;

-- 5) Trigger to aggregate costs/tokens into llm_budgets on ai_logs insert
CREATE OR REPLACE FUNCTION public.increment_budget_on_ai_logs()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.llm_budgets (user_id, date, spent_usd, spent_tokens_in, spent_tokens_out)
  VALUES (NEW.user_id, (now() at time zone 'utc')::date, COALESCE(NEW.cost_usd,0), COALESCE(NEW.request_tokens,0), COALESCE(NEW.response_tokens,0))
  ON CONFLICT (user_id, date) DO UPDATE
  SET spent_usd = public.llm_budgets.spent_usd + COALESCE(NEW.cost_usd,0),
      spent_tokens_in = public.llm_budgets.spent_tokens_in + COALESCE(NEW.request_tokens,0),
      spent_tokens_out = public.llm_budgets.spent_tokens_out + COALESCE(NEW.response_tokens,0),
      updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_logs_budget'
  ) THEN
    CREATE TRIGGER trg_ai_logs_budget
    AFTER INSERT ON public.ai_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_budget_on_ai_logs();
  END IF;
END $$;

-- 6) Helpful index for memories filtering by user/date
CREATE INDEX IF NOT EXISTS idx_memories_user_created ON public.memories(user_id, created_at DESC);
