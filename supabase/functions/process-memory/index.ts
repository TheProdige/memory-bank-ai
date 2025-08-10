import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-MEMORY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error('User not authenticated');

    logStep("User authenticated", { userId: user.id });

    const { transcript, title } = await req.json();
    if (!transcript) {
      throw new Error('No transcript provided');
    }

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    logStep("Processing transcript", { transcriptLength: transcript.length });

    // Build analysis prompt
    const analysisPrompt = `Analyze this audio transcript and provide:\n\n1. A concise summary (max 150 words)\n2. Key topics/themes as tags (max 5 tags, single words or short phrases)\n3. Emotional tone (one of: positive, neutral, negative, excited, contemplative, stressed, happy, sad, angry, curious, motivated)\n4. A suggested title if none provided (max 50 characters)\n\nTranscript: "${transcript}"\n\nRespond in JSON format:\n{\n  "summary": "...",\n  "tags": ["tag1", "tag2", "tag3"],\n  "emotion": "emotional_tone",\n  "suggested_title": "..."\n}`;

    // Cheap local analysis to avoid LLM for simple cases
    const localAnalyze = (text: string, t?: string) => {
      const clean = (text || '').replace(/\s+/g, ' ').trim();
      const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
      const summary = sentences.slice(0, 2).join(' ').slice(0, 400);
      const words = clean.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüç0-9\s-]/gi, ' ').split(/\s+/).filter(w => w.length > 3);
      const freq: Record<string, number> = {};
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
      const stop = new Set(['avec','pour','dans','alors','parce','mais','donc','cette','cela','comme','plus','moins','tres','tout','nous','vous','elles','cela','cest','chez','entre','quand','aussi','avoir','être','faire','comme','from','with','this','that','they','them','have','been','were','what','your','about','just']);
      const tags = Object.entries(freq)
        .filter(([w]) => !stop.has(w))
        .sort((a,b) => b[1]-a[1])
        .slice(0,5)
        .map(([w]) => w);
      const emoMap: Record<string,string> = { 'heureux':'happy','content':'happy','joyeux':'happy','triste':'sad','stress':'stressed','énervé':'angry','colère':'angry','fatigu':'contemplative','motivé':'motivated','motivation':'motivated','curieux':'curious','inquiet':'stressed','anxieux':'stressed','bien':'positive','mal':'negative' };
      let emotion = 'neutral';
      for (const [k,v] of Object.entries(emoMap)) { if (clean.toLowerCase().includes(k)) { emotion = v; break; } }
      const suggested_title = t || (sentences[0]?.slice(0, 50) || 'Nouveau souvenir');
      return { summary: summary || clean.slice(0,150), tags, emotion, suggested_title };
    };

    let analysis: any | null = null;
    const shouldUseLocal = transcript.length <= 400 || (transcript.split(/[.!?]/).length <= 2);

    if (!shouldUseLocal) {
      // Use centralized AI gateway (caching, routing, logging)
      const supabaseAnon = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );

      const system = 'You are an AI assistant that analyzes audio transcripts to extract meaningful insights. Always respond with valid JSON format.';

      const { data: gatewayResp, error: gatewayErr } = await supabaseAnon.functions.invoke('ai-gateway', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          task: {
            type: 'chat',
            system,
            input: analysisPrompt,
            complexity: 'force_simple',
            cache_ttl_seconds: 60 * 60 * 24 * 7, // 7 days
            params: { temperature: 0.2, max_tokens: 220 }
          }
        }
      });

      if (!gatewayErr) {
        const content = gatewayResp?.data?.content || gatewayResp?.results?.[0]?.data?.content;
        const budgetExceeded = gatewayResp?.error === 'budget_exceeded' || gatewayResp?.results?.[0]?.error === 'budget_exceeded';
        if (content && !budgetExceeded) {
          try { analysis = JSON.parse(content); } catch {}
        }
      }
    }

    if (!analysis) {
      // Fallback/local path
      analysis = localAnalyze(transcript, title);
    }

    const finalTitle = title || analysis.suggested_title || "Nouveau souvenir";

    // Store the memory in the database
    const { data: memory, error: insertError } = await supabaseClient
      .from('memories')
      .insert({
        user_id: user.id,
        title: finalTitle,
        transcript: transcript,
        summary: analysis.summary,
        tags: analysis.tags,
        emotion: analysis.emotion
      })
      .select()
      .single();

    if (insertError) {
      logStep("Database insert error", { error: insertError });
      throw new Error(`Failed to save memory: ${insertError.message}`);
    }

    logStep("Memory saved successfully", { memoryId: memory.id });

    // Create RAG chunks and store embeddings (best-effort, non-blocking on errors)
    try {
      const makeChunks = (text: string, chunkSize = 800) => {
        const s = (text || '').replace(/\s+/g, ' ').trim();
        const chunks: string[] = [];
        for (let i = 0; i < s.length; i += chunkSize) chunks.push(s.slice(i, i + chunkSize));
        return chunks;
      };

      const baseChunks = makeChunks(transcript, 800).slice(0, 5); // frugal: cap to 5
      if (baseChunks.length > 0) {
        // Dedup by content_hash
        const enc = new TextEncoder();
        const hashes = await Promise.all(baseChunks.map(async (c) => {
          const buf = await crypto.subtle.digest('SHA-256', enc.encode(c));
          return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
        }));
        const { data: existingRows } = await supabaseClient
          .from('memory_chunks')
          .select('content_hash')
          .eq('user_id', user.id)
          .in('content_hash', hashes);
        const existing = new Set((existingRows || []).map(r => r.content_hash));
        const toEmbed = baseChunks
          .map((c, i) => ({ c, i, h: hashes[i] }))
          .filter(x => !existing.has(x.h));

        if (toEmbed.length > 0) {
          const { data: embResp, error: embErr } = await supabaseAnon.functions.invoke('ai-gateway', {
            headers: { Authorization: `Bearer ${token}` },
            body: { task: { type: 'embed', input: toEmbed.map(x => x.c), cache_ttl_seconds: 60 * 60 * 24 * 30 } }
          });
          if (embErr) throw new Error(embErr.message);
          const embeddings: number[][] = embResp?.data?.embeddings || embResp?.results?.[0]?.data?.embeddings || [];
          if (embeddings.length === toEmbed.length) {
            const rows = toEmbed.map((x, idx) => ({
              user_id: user.id,
              memory_id: memory.id,
              content: x.c,
              embedding: embeddings[idx],
              content_hash: x.h,
            }));
            const { error: insertChunksErr } = await supabaseClient.from('memory_chunks').insert(rows);
            if (insertChunksErr) throw insertChunksErr;
            logStep("Embeddings stored", { count: rows.length });
          }
        } else {
          logStep("Embeddings skipped - all chunks already embedded");
        }
      }
    } catch (e) {
      logStep("Embeddings step failed (non-blocking)", { error: String(e) });
    }

    // Update user's memory count
    await supabaseClient
      .from('profiles')
      .update({ 
        memories_count: supabaseClient.rpc('increment_memory_count', { user_id: user.id })
      })
      .eq('user_id', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        memory: {
          id: memory.id,
          title: memory.title,
          summary: memory.summary,
          tags: memory.tags,
          emotion: memory.emotion,
          created_at: memory.created_at
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});