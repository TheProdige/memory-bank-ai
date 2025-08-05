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

    // Use GPT-4.1 to analyze the transcript
    const analysisPrompt = `Analyze this audio transcript and provide:

1. A concise summary (max 150 words)
2. Key topics/themes as tags (max 5 tags, single words or short phrases)
3. Emotional tone (one of: positive, neutral, negative, excited, contemplative, stressed, happy, sad, angry, curious, motivated)
4. A suggested title if none provided (max 50 characters)

Transcript: "${transcript}"

Respond in JSON format:
{
  "summary": "...",
  "tags": ["tag1", "tag2", "tag3"],
  "emotion": "emotional_tone",
  "suggested_title": "..."
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that analyzes audio transcripts to extract meaningful insights. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep("OpenAI API error", { status: response.status, error: errorText });
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const aiResult = await response.json();
    const analysisText = aiResult.choices[0].message.content;
    
    logStep("AI analysis completed", { analysisLength: analysisText.length });

    // Parse the JSON response from GPT
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      logStep("JSON parse error, using fallback", { error: parseError });
      // Fallback if JSON parsing fails
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