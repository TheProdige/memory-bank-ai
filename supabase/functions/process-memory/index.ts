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

    logStep("Processing transcript", { transcriptLength: transcript.length });

    // Build analysis prompt
    const analysisPrompt = `Analyze this audio transcript and provide:\n\n1. A concise summary (max 150 words)\n2. Key topics/themes as tags (max 5 tags, single words or short phrases)\n3. Emotional tone (one of: positive, neutral, negative, excited, contemplative, stressed, happy, sad, angry, curious, motivated)\n4. A suggested title if none provided (max 50 characters)\n\nTranscript: "${transcript}"\n\nRespond in JSON format:\n{\n  "summary": "...",\n  "tags": ["tag1", "tag2", "tag3"],\n  "emotion": "emotional_tone",\n  "suggested_title": "..."\n}`;

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
          complexity: 'auto',
          cache_ttl_seconds: 60 * 60 * 24 * 7, // 7 days
          params: { temperature: 0.3, max_tokens: 500 }
        }
      }
    });

    if (gatewayErr) {
      throw new Error(gatewayErr.message);
    }

    const content = gatewayResp?.data?.content || gatewayResp?.results?.[0]?.data?.content;
    if (!content) throw new Error('AI gateway returned no content');

    logStep("AI analysis completed", { analysisLength: content.length });

    // Parse the JSON response from AI
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      logStep("JSON parse error, using fallback", { error: parseError });
      analysis = {
        summary: transcript.length > 150 ? transcript.substring(0, 150) + "..." : transcript,
        tags: ["memory", "note"],
        emotion: "neutral",
        suggested_title: title || "Nouveau souvenir"
      };
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

      const chunks = makeChunks(transcript, 800).slice(0, 64); // cap to avoid overload
      if (chunks.length > 0) {
        const { data: embResp, error: embErr } = await supabaseAnon.functions.invoke('ai-gateway', {
          headers: { Authorization: `Bearer ${token}` },
          body: { task: { type: 'embed', input: chunks, cache_ttl_seconds: 60 * 60 * 24 * 30 } }
        });
        if (embErr) throw new Error(embErr.message);
        const embeddings: number[][] = embResp?.data?.embeddings || embResp?.results?.[0]?.data?.embeddings || [];
        if (embeddings.length === chunks.length) {
          const rows = embeddings.map((emb, i) => ({
            user_id: user.id,
            memory_id: memory.id,
            content: chunks[i],
            embedding: emb
          }));
          const { error: insertChunksErr } = await supabaseClient.from('memory_chunks').insert(rows);
          if (insertChunksErr) throw insertChunksErr;
          logStep("Embeddings stored", { count: rows.length });
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