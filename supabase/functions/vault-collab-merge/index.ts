import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function log(step: string, details?: unknown) {
  console.log(`[vault-collab-merge] ${step}`, details ?? "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log("Missing required environment variables");
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const { vault_id, save = true, max_notes = 100 } = body;

    if (!vault_id) {
      return new Response(JSON.stringify({ error: "vault_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate caller
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Ensure membership (RLS on vault_members allows members/owner to see rows)
    const { data: membership, error: membershipErr } = await userClient
      .from("vault_members")
      .select("id")
      .eq("vault_id", vault_id)
      .limit(1);

    if (membershipErr) {
      log("Membership check error", membershipErr);
    }

    if (!membership || membership.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch notes in the vault (RLS: members can read vault notes)
    const { data: notes, error: notesErr } = await userClient
      .from("notes")
      .select("id,title,content,tags,user_id,created_at")
      .eq("vault_id", vault_id)
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(1000, max_notes)));

    if (notesErr) throw notesErr;

    if (!notes || notes.length === 0) {
      return new Response(JSON.stringify({ error: "No notes found in this vault" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare compact input for the model
    const modelInput = notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: (n as any).content || "",
      tags: (n as any).tags || [],
      author: n.user_id,
      created_at: n.created_at,
    }));

    const systemPrompt = `You merge and organize multiple notes from a shared knowledge vault.
Return ONLY a strict JSON object with the following shape (no markdown, no backticks):
{
  "merged_title": string,
  "summary": string,
  "key_points": string[],
  "action_items": string[],
  "themes": string[],
  "contributors": string[],
  "merged_content": string
}`;

    const userPrompt = `Here are ${modelInput.length} notes from a team vault. Deduplicate, cluster by themes, extract action items, and produce a clear merged content. Keep it concise but comprehensive. Input notes JSON: ${JSON.stringify(modelInput)}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      log("OpenAI error", errText);
      return new Response(JSON.stringify({ error: "OpenAI API error", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content ?? "{}";

    let merged: any;
    try {
      merged = JSON.parse(content);
    } catch {
      // Fallback: try to salvage JSON by trimming around first/last braces
      const first = content.indexOf("{");
      const last = content.lastIndexOf("}");
      if (first >= 0 && last > first) {
        merged = JSON.parse(content.slice(first, last + 1));
      } else {
        throw new Error("Failed to parse AI JSON output");
      }
    }

    let createdNoteId: string | null = null;
    if (save) {
      // Save merged note into the same vault, owned by caller
      const { data: inserted, error: insErr } = await userClient
        .from("notes")
        .insert({
          user_id: userId,
          vault_id,
          title: merged.merged_title || "Synthèse du vault",
          content: merged.merged_content || merged.summary || "",
          tags: merged.themes || [],
        })
        .select("id")
        .single();

      if (insErr) {
        log("Insert note error", insErr);
      } else {
        createdNoteId = inserted?.id ?? null;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        vault_id,
        merged,
        created_note_id: createdNoteId,
        notes_processed: notes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    log("Unhandled error", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
