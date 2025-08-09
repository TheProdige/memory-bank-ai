import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function log(step: string, details?: unknown) {
  console.log(`[proactive-engine] ${step}`, details ?? "");
}

async function runForUser(userId: string, client: any) {
  let processedRules = 0;
  let createdEvents = 0;

  const { data: rules, error: rulesErr } = await client
    .from("proactive_rules")
    .select("id,user_id,vault_id,conditions,action,is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (rulesErr) throw rulesErr;
  if (!rules || rules.length === 0) return { processedRules, createdEvents };

  for (const rule of rules) {
    processedRules++;

    const conditions = (rule as any).conditions || {};
    const action = (rule as any).action || {};

    if (conditions.type !== "keyword_match") {
      log("Skipping rule (unsupported type)", { rule_id: rule.id, type: conditions.type });
      continue;
    }

    const keyword = String(conditions.keyword || "").trim();
    if (!keyword) continue;

    const lookbackDays = Number(conditions.lookback_days ?? 90);
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    let q = client
      .from("notes")
      .select("id,title,content,created_at,vault_id,user_id")
      .gte("created_at", since)
      .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`);

    if (rule.vault_id) {
      q = q.eq("vault_id", rule.vault_id);
    } else {
      q = q.eq("user_id", userId);
    }

    const { data: notes, error: notesErr } = await q;
    if (notesErr) throw notesErr;
    if (!notes || notes.length === 0) continue;

    for (const note of notes) {
      // Avoid duplicates in the last 24h for the same rule+note
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing, error: existErr } = await client
        .from("proactive_events")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("user_id", userId)
        .gte("created_at", since24h)
        .filter("payload->>note_id", "eq", note.id)
        .limit(1);

      if (existErr) throw existErr;
      if (existing && existing.length > 0) continue;

      const payload = {
        type: "keyword_match",
        keyword,
        note_id: note.id,
        title: note.title,
        created_at: note.created_at,
      } as const;

      const { error: insErr } = await client.from("proactive_events").insert({
        rule_id: rule.id,
        user_id: userId,
        vault_id: rule.vault_id ?? null,
        status: "triggered",
        payload,
      });

      if (insErr) throw insErr;
      createdEvents++;
    }
  }

  return { processedRules, createdEvents };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    log("Missing Supabase env vars");
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = (await req.json().catch(() => ({}))) as { mode?: string; user_id?: string };

    // If called by an authenticated user, run only for that user with RLS
    const { data: userData } = await userClient.auth.getUser();

    if (userData?.user) {
      const { processedRules, createdEvents } = await runForUser(userData.user.id, userClient);
      return new Response(JSON.stringify({ ok: true, scope: "user", processedRules, createdEvents }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Otherwise, run in admin/cron mode across all active rules
    const { data: rules, error: rulesErr } = await admin
      .from("proactive_rules")
      .select("user_id")
      .eq("is_active", true);

    if (rulesErr) throw rulesErr;

    const userIds = Array.from(new Set((rules ?? []).map((r: any) => r.user_id))).filter(Boolean);

    let processedRules = 0;
    let createdEvents = 0;

    for (const uid of userIds) {
      const result = await runForUser(uid, admin);
      processedRules += result.processedRules;
      createdEvents += result.createdEvents;
    }

    return new Response(
      JSON.stringify({ ok: true, scope: "admin", usersProcessed: userIds.length, processedRules, createdEvents }),
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
