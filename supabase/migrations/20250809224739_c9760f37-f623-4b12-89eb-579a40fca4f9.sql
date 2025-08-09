-- Fix RPC signature to use vector type with search_path including extensions
create or replace function public.match_memory_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  memory_id uuid,
  content text,
  distance float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select mc.id, mc.memory_id, mc.content,
         (mc.embedding <-> query_embedding) as distance
  from public.memory_chunks mc
  where mc.user_id = auth.uid()
  and (match_threshold is null or (mc.embedding <-> query_embedding) <= match_threshold)
  order by mc.embedding <-> query_embedding asc
  limit match_count;
$$;