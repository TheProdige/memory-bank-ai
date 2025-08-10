import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple sha256 helper
async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Token estimation (rough): ~4 chars per token
const estimateTokens = (text: string) => Math.ceil((text || '').length / 4);

// Very light server-side compression: clamp length and collapse whitespace
function compressText(text: string, max = 4000) {
  if (!text) return '';
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  // Keep start and end context
  const head = collapsed.slice(0, Math.floor(max * 0.7));
  const tail = collapsed.slice(-Math.floor(max * 0.3));
  return `${head}\n...\n${tail}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const t0 = Date.now();

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY is not set');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header provided');
    const jwt = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Resolve current user for RLS inserts
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      throw new Error('Failed to resolve user from JWT');
    }
    const userId = userData.user.id;

    const { task, tasks, cache_ttl_seconds } = await req.json();
    const items = tasks ?? (task ? [task] : []);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No task(s) provided');
    }

    // Process embedding inputs in batch for efficiency
    const runEmbeddings = async (input: string[] | string) => {
      const inputs = Array.isArray(input) ? input : [input];
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: inputs,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI Embeddings error: ${text}`);
      }
      const json = await response.json();
      return json.data.map((d: any) => d.embedding as number[]);
    };

    const results: any[] = [];

    for (const payload of items) {
      const type = payload?.type; // 'chat' | 'embed'
      const nowIso = new Date().toISOString();
      const ttl = typeof payload?.cache_ttl_seconds === 'number' ? payload.cache_ttl_seconds : (typeof cache_ttl_seconds === 'number' ? cache_ttl_seconds : 60 * 60 * 24 * 7);

      // Build cache key
      const cacheKeySource = JSON.stringify({ type, input: payload?.input, system: payload?.system, router: payload?.complexity, params: payload?.params });
      const key = await sha256(cacheKeySource);

      // Try cache
      let cacheHit = false;
      let cached: any = null;
      if (payload?.use_cache !== false) {
        const { data: cacheRows, error: cacheErr } = await supabase
          .from('ai_cache')
          .select('result, model, tokens_estimated, expires_at')
          .eq('user_id', userId)
          .eq('key', key)
          .gt('expires_at', nowIso)
          .limit(1);
        if (cacheErr) console.warn('[AI-GATEWAY] Cache read error', cacheErr);
        if (cacheRows && cacheRows.length > 0) {
          cached = cacheRows[0];
          cacheHit = true;
        }
      }

      if (cacheHit) {
        results.push({ ok: true, type, model: cached.model, data: cached.result, cache_hit: true });
        // Log
        await supabase.from('ai_logs').insert({
          user_id: userId,
          operation: type,
          model: cached.model,
          request_tokens: 0,
          response_tokens: cached.tokens_estimated ?? 0,
          cost_usd: 0,
          latency_ms: Date.now() - t0,
          prompt_chars: 0,
          cache_hit: true,
          request_fingerprint: key,
        });
        continue;
      }

      if (type === 'embed') {
        const input = payload?.input;
        if (!input) throw new Error('Missing input for embed');
        const texts = Array.isArray(input) ? input.map((s: string) => compressText(s, 8000)) : [compressText(input, 8000)];

        // Budget pre-check (very cheap estimate)
        const reqTokensEst = texts.reduce((n, s) => n + estimateTokens(s), 0);
        const estCost = (reqTokensEst / 1000) * 0.00002; // rough price for embeddings
        const today = new Date().toISOString().slice(0, 10);
        const dailyDefault = Number(Deno.env.get('LLM_DAILY_BUDGET_USD') || '0.5');
        const { data: budgetRows } = await supabase
          .from('llm_budgets')
          .select('spent_usd, daily_limit_usd')
          .eq('user_id', userId)
          .eq('date', today)
          .limit(1);
        const spent = budgetRows?.[0]?.spent_usd ?? 0;
        const limit = budgetRows?.[0]?.daily_limit_usd ?? dailyDefault;
        if (spent + estCost > limit) {
          // Skip embeddings under budget pressure
          results.push({ ok: true, type, model: 'text-embedding-3-small', data: { embeddings: [] }, cache_hit: false, degraded: 'budget_exceeded' });
          continue;
        }

        const embeddings = await runEmbeddings(texts);
        const responseTokens = embeddings.length * 1536; // rough
        const model = 'text-embedding-3-small';

        // Cache result
        await supabase.from('ai_cache').insert({
          key,
          user_id: userId,
          result: { embeddings },
          model,
          tokens_estimated: responseTokens,
          expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
          request_fingerprint: key,
        });

        // Log
        await supabase.from('ai_logs').insert({
          user_id: userId,
          operation: 'embed',
          model,
          request_tokens: reqTokensEst,
          response_tokens: responseTokens,
          cost_usd: estCost,
          latency_ms: Date.now() - t0,
          prompt_chars: texts.join('\n').length,
          cache_hit: false,
          request_fingerprint: key,
        });

        results.push({ ok: true, type, model, data: { embeddings }, cache_hit: false });
        continue;
      }

      if (type === 'chat') {
        const system = payload?.system || 'You are a concise assistant. Always return compact answers in strict JSON when asked.';
        const userInputRaw = typeof payload?.input === 'string' ? payload.input : JSON.stringify(payload?.input || {});
        const userInput = payload?.preprocess === false ? userInputRaw : compressText(userInputRaw, payload?.max_input_chars ?? 4000);
        const routeOnLowConfidence = payload?.route_large_on_low_conf !== false; // default true
        // Default small model, escalate only if needed
        let model = payload?.model || 'gpt-4o-mini';
        const params = {
          temperature: payload?.params?.temperature ?? 0.2,
          max_tokens: payload?.params?.max_tokens ?? 280,
          stop: payload?.params?.stop ?? ['__END__'],
        } as Record<string, any>;

        // Budget pre-check with conservative estimate
        const reqTokensEst = estimateTokens(system + userInput);
        const respMax = params.max_tokens;
        const pricing: Record<string, { in: number; out: number }> = {
          'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
          'gpt-4.1-2025-04-14': { in: 0.005, out: 0.015 },
        };
        const dailyDefault = Number(Deno.env.get('LLM_DAILY_BUDGET_USD') || '0.5');
        const rate = pricing[model] ?? pricing['gpt-4o-mini'];
        const estCost = (reqTokensEst / 1000) * rate.in + (respMax / 1000) * rate.out;
        const today = new Date().toISOString().slice(0, 10);
        const { data: budgetRows } = await supabase
          .from('llm_budgets')
          .select('spent_usd, daily_limit_usd')
          .eq('user_id', userId)
          .eq('date', today)
          .limit(1);
        const spent = budgetRows?.[0]?.spent_usd ?? 0;
        const limit = budgetRows?.[0]?.daily_limit_usd ?? dailyDefault;
        if (spent + estCost > limit) {
          results.push({ ok: false, type, error: 'budget_exceeded' });
          continue;
        }

        const buildBody = (mdl: string) => ({
          model: mdl,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userInput }
          ],
          response_format: { type: 'json_object' },
          ...params,
        });

        // 1) Call small model
        let usedModel = model;
        let resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildBody(usedModel)),
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`OpenAI Chat error: ${text}`);
        }
        let json = await resp.json();
        let content: string = json.choices?.[0]?.message?.content ?? '';
        let parsed: any = undefined;
        try { parsed = JSON.parse(content); } catch {}
        const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : (content.length > 120 ? 0.85 : 0.6);

        // 2) Escalate only if confidence low
        if (routeOnLowConfidence && confidence < 0.75) {
          usedModel = 'gpt-4.1-2025-04-14';
          const rate2 = pricing[usedModel];
          const extraCost = (respMax / 1000) * rate2.out; // conservative
          if (spent + estCost + extraCost <= limit) {
            resp = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(buildBody(usedModel)),
            });
            if (!resp.ok) {
              const text = await resp.text();
              throw new Error(`OpenAI Chat error: ${text}`);
            }
            json = await resp.json();
            content = json.choices?.[0]?.message?.content ?? content;
          }
        }

        // Cache result
        await supabase.from('ai_cache').insert({
          key,
          user_id: userId,
          result: { content },
          model: usedModel,
          tokens_estimated: estimateTokens(content),
          expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
          request_fingerprint: key,
        });

        // Log with token-based cost
        const reqTok = reqTokensEst;
        const respTok = estimateTokens(content);
        const rateUsed = pricing[usedModel] ?? rate;
        const costUsd = (reqTok / 1000) * rateUsed.in + (respTok / 1000) * rateUsed.out;
        await supabase.from('ai_logs').insert({
          user_id: userId,
          operation: 'chat',
          model: usedModel,
          request_tokens: reqTok,
          response_tokens: respTok,
          cost_usd: costUsd,
          latency_ms: Date.now() - t0,
          prompt_chars: (system + userInput).length,
          cache_hit: false,
          request_fingerprint: key,
        });

        results.push({ ok: true, type, model: usedModel, data: { content }, cache_hit: false });
        continue;
      }

      throw new Error(`Unsupported task type: ${type}`);
    }

    const payloadResult = tasks ? { results } : (results[0] || { ok: false });
    return new Response(JSON.stringify(payloadResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AI-GATEWAY] ERROR', message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
