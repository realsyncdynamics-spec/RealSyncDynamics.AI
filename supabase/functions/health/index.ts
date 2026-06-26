// Public Health-Endpoint — verify_jwt=false (supabase/config.toml).
//
// GET /functions/v1/health
//   200 — { status: 'ok' | 'degraded', ... }   alle / Teil-Checks gruen
//   503 — { status: 'down', ... }              kritischer Check rot (DB unerreichbar)
//
// Logik liegt isoliert in supabase/functions/_shared/health.ts (testbar in vitest).
// Diese Datei haelt nur die Deno-Runtime-Verkabelung (env + Supabase-Client + CORS).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkHealth, type HealthDbClient } from '../_shared/health.ts';
import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const VERSION = '2026.05.0';

const corsHeaders = buildCorsHeaders('GET, OPTIONS');

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'GET') {
    return json({ status: 'down', error: 'method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const db: HealthDbClient | null = SUPABASE_URL && SRK
    ? createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } }) as unknown as HealthDbClient
    : null;

  const summary = await checkHealth({
    db,
    env: { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SRK },
    version: VERSION,
  });

  const status = summary.status === 'down' ? 503 : 200;
  return jsonResponse(summary, status, corsHeaders);
});

function json(body: unknown, status: number): Response {
  return jsonResponse(body, status, corsHeaders);
}
