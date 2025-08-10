import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const now = new Date().toISOString();

    // Fetch a small batch of queued jobs scheduled for now or earlier
    const { data: jobs, error: fetchErr } = await supabase
      .from('ai_jobs')
      .select('id, user_id, type, payload')
      .eq('status', 'queued')
      .lte('scheduled_for', now)
      .limit(25);
    if (fetchErr) throw fetchErr;

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mark as processing
    const ids = jobs.map(j => j.id);
    await supabase.from('ai_jobs').update({ status: 'processing' }).in('id', ids);

    let processed = 0;

    for (const job of jobs) {
      try {
        if (job.type === 'embed') {
          const inputArr: string[] = job.payload?.input ?? [];
          if (!Array.isArray(inputArr) || inputArr.length === 0) throw new Error('invalid embed payload');

          // Use AI gateway for batching/cost logging under user's context is not possible here.
          // Compute embeddings directly as a fallback; costs should be accounted separately if needed.
          const openaiKey = Deno.env.get('OPENAI_API_KEY');
          if (!openaiKey) throw new Error('OPENAI_API_KEY is not set');

          const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'text-embedding-3-small', input: inputArr })
          });
          if (!response.ok) throw new Error(await response.text());
          const json = await response.json();
          const embeddings: number[][] = json.data.map((d: any) => d.embedding);

          // Store results to memory_chunks if memory_id and content list provided
          const memoryId = job.payload?.memory_id;
          const userId = job.user_id;
          if (memoryId && userId) {
            const rows = inputArr.map((c: string, idx: number) => ({
              user_id: userId,
              memory_id: memoryId,
              content: c,
              embedding: embeddings[idx],
            }));
            const { error: insErr } = await supabase.from('memory_chunks').insert(rows);
            if (insErr) throw insErr;
          }
        }

        await supabase.from('ai_jobs').update({ status: 'done', error: null }).eq('id', job.id);
        processed += 1;
      } catch (e) {
        await supabase.from('ai_jobs').update({ status: 'error', error: String(e) }).eq('id', job.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[BATCH-JOBS] ERROR', message);
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
