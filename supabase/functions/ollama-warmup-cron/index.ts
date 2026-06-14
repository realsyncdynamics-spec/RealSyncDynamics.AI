// Ollama-Warmup-Cron — taeglich.
//
// Holt alle distinct ai_tools.ollama_model_id, vergleicht mit dem was die
// Ollama-Instanz tatsaechlich gepullt hat (/api/tags), und triggert fuer
// fehlende Modelle einen fire-and-forget /api/pull. So konvergiert der VPS
// auch ohne User-Verkehr auf den Soll-Zustand der DB — Sicherheitsnetz
// fuer den Auto-Pull-Guard in providers.ts, der nur bei tatsaechlichem
// User-Call greift.
//
// Cron-Schedule: einmal taeglich, z.B. 03:00 UTC (geringe VPS-Last).
// Eintrag via `supabase functions schedule` oder pg_cron. Tabelle:
//   select cron.schedule('ollama-warmup', '0 3 * * *',
//     $$ select net.http_post(...) $$);

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AiToolRow {
  ollama_model_id: string | null;
}

async function getSecret(envVar: string, vaultName: string, admin: ReturnType<typeof createClient>): Promise<string | null> {
  const fromEnv = Deno.env.get(envVar);
  if (fromEnv) return fromEnv;
  const { data, error } = await admin.rpc('get_app_secret', { secret_name: vaultName });
  if (error) return null;
  return typeof data === 'string' && data.length > 0 ? data : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const baseUrl = await getSecret('OLLAMA_URL', 'ollama_url', admin);
  if (!baseUrl) {
    return json({ ok: false, error: 'OLLAMA_URL not configured (env+vault)' }, 503);
  }
  const cred = await getSecret('OLLAMA_AUTH_TOKEN', 'ollama_auth_token', admin);
  const headers: Record<string, string> = {};
  if (cred) headers['Authorization'] = `Basic ${btoa(cred)}`;

  const { data: rows, error: dbErr } = await admin
    .from('ai_tools')
    .select('ollama_model_id')
    .eq('enabled', true)
    .not('ollama_model_id', 'is', null);
  if (dbErr) return json({ ok: false, error: `db: ${dbErr.message}` }, 500);

  const required = Array.from(
    new Set(((rows ?? []) as AiToolRow[])
      .map((r) => r.ollama_model_id)
      .filter((m): m is string => !!m)),
  );

  if (required.length === 0) {
    return json({ ok: true, required: [], loaded: [], missing: [], triggered: [] });
  }

  const cleanBase = baseUrl.replace(/\/$/, '');
  let loaded: string[] = [];
  try {
    const tagsResp = await fetch(`${cleanBase}/api/tags`, { headers });
    if (!tagsResp.ok) return json({ ok: false, error: `tags HTTP ${tagsResp.status}` }, 502);
    const tags = await tagsResp.json() as { models?: Array<{ name?: string; model?: string }> };
    loaded = (tags.models ?? []).map((m) => m.name ?? m.model ?? '').filter((s) => s.length > 0);
  } catch (e) {
    return json({ ok: false, error: `tags fetch: ${(e as Error).message}` }, 502);
  }

  const loadedSet = new Set(loaded);
  const missing = required.filter((m) => !loadedSet.has(m));
  const triggered: string[] = [];

  for (const model of missing) {
    // Fire-and-forget: /api/pull blockiert bis Pull fertig (kann Minuten dauern).
    // Wir warten nicht — der Pull laeuft auf dem VPS weiter, auch wenn wir hier
    // schon antworten. Beim naechsten Cron-Run (oder User-Call) ist das Modell da.
    fetch(`${cleanBase}/api/pull`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
    }).catch((e) => console.error(`[ollama-warmup] pull ${model} failed: ${(e as Error).message}`));
    triggered.push(model);
  }

  return json({ ok: true, required, loaded, missing, triggered });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
