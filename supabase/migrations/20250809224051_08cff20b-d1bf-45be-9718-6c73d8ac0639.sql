-- 1) Extensions
create extension if not exists vector with schema extensions;

-- 2) AI Cache table
create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  key text not null,
  result jsonb not null,
  model text,
  request_fingerprint text,
  tokens_estimated int,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create unique index if not exists ai_cache_user_key_unique on public.ai_cache(user_id, key);

-- 3) AI Logs table
create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  operation text not null,
  model text,
  request_tokens int,
  response_tokens int,
  cost_usd numeric(10,6),
  latency_ms int,
  prompt_chars int,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ai_logs_user_created_at_idx on public.ai_logs(user_id, created_at desc);

-- 4) Memory chunks with embeddings (RAG)
create table if not exists public.memory_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  memory_id uuid references public.memories(id) on delete cascade,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
create index if not exists memory_chunks_user_memory_idx on public.memory_chunks(user_id, memory_id);
create index if not exists memory_chunks_embedding_ivfflat on public.memory_chunks using ivfflat (embedding) with (lists = 100);

-- 5) Enable RLS
alter table public.ai_cache enable row level security;
alter table public.ai_logs enable row level security;
alter table public.memory_chunks enable row level security;

-- 6) RLS policies
-- ai_cache: users can read and insert their own cache rows, update/delete not necessary
create policy if not exists "Users read their own ai_cache" on public.ai_cache
for select using (auth.uid() = user_id);
create policy if not exists "Users insert their own ai_cache" on public.ai_cache
for insert with check (auth.uid() = user_id);

-- ai_logs: users can read their own logs, inserts by themselves
create policy if not exists "Users read their own ai_logs" on public.ai_logs
for select using (auth.uid() = user_id);
create policy if not exists "Users insert their own ai_logs" on public.ai_logs
for insert with check (auth.uid() = user_id);

-- memory_chunks: users can read/insert their own chunks, delete cascades with memory
create policy if not exists "Users read their own memory_chunks" on public.memory_chunks
for select using (auth.uid() = user_id);
create policy if not exists "Users insert their own memory_chunks" on public.memory_chunks
for insert with check (auth.uid() = user_id);
create policy if not exists "Users delete their own memory_chunks" on public.memory_chunks
for delete using (auth.uid() = user_id);

-- 7) RPC for vector search over memory_chunks (RAG)
create or replace function public.match_memory_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  memory_id uuid,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select mc.id, mc.memory_id, mc.content,
         1 - (mc.embedding <#> query_embedding) as similarity
  from public.memory_chunks mc
  where mc.user_id = auth.uid()
  and (1 - (mc.embedding <#> query_embedding)) >= match_threshold
  order by mc.embedding <#> query_embedding
  limit match_count;
$$;

-- 8) Helpful comment to encourage ANALYZE for better IVFFlat performance
comment on index memory_chunks_embedding_ivfflat is 'Run ANALYZE memory_chunks after large inserts to optimize IVF lists';