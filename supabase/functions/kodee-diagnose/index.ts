// Kodee VPS AI Diagnose — orchestrates a few read-only VPS actions and feeds
// the combined output into the `vps_status` AI tool for a holistic assessment.
//
// POST /functions/v1/kodee-diagnose
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, connection_id: uuid, domain?: string }
//
// Pipeline:
//   1. JWT verify + tenant membership.
//   2. Load vps_connection (owner-scoped, defense-in-depth).
//   3. Decrypt SSH private key.
//   4. Run vps.status + vps.disk in parallel via SSH; vps.dns/tls_check for
//      the domain (defaults to the connection's host).
//   5. Concatenate the structured outputs into a Markdown prompt.
//   6. runAiTool(..., 'vps_status', prompt) — billed against the tenant's AI
//      quota and audit-logged in ai_tool_runs.
//   7. Return the AI diagnosis + the raw evidence (so the frontend can render
//      both the verdict and the underlying data).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import { dispatch } from '../kodee/actions.ts';
import { decryptPrivateKey } from '../kodee/secrets.ts';
import type { VpsConnectionRow } from '../kodee/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: { tenant_id?: string; connection_id?: string; domain?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.tenant_id || !body.connection_id) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and connection_id required');
  }

  // Tenant membership check via RLS (using the user's JWT)
  const { data: member, error: memberErr } = await userClient
    .from('memberships').select('id')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Load connection (owner-scoped — vps_connections is per-user in v1)
  const { data: conn, error: connErr } = await admin
    .from('vps_connections').select('*')
    .eq('id', body.connection_id).eq('owner_id', userId)
    .maybeSingle<VpsConnectionRow>();
  if (connErr) return jsonError(500, 'INTERNAL', connErr.message);
  if (!conn)   return jsonError(404, 'NOT_FOUND', 'connection not found');

  // Decrypt SSH key
  const { data: keyRow, error: keyErr } = await admin
    .from('vps_ssh_keys').select('encrypted_private_key')
    .eq('connection_id', conn.id).maybeSingle<{ encrypted_private_key: string }>();
  if (keyErr || !keyRow) return jsonError(404, 'NOT_FOUND', 'ssh key missing');
  let privateKey: string;
  try { privateKey = await decryptPrivateKey(keyRow.encrypted_private_key); }
  catch (e) { return jsonError(500, 'INTERNAL', `decrypt failed: ${(e as Error).message}`); }

  const ctx = { conn, privateKey };
  const domain = body.domain ?? conn.host;

  // Run evidence-gathering actions concurrently. Failures don't abort — we
  // pass whatever evidence we have to the model and label the rest as failed.
  const [statusR, diskR, dnsR, tlsR] = await Promise.allSettled([
    dispatch('vps.status',    {},                ctx),
    dispatch('vps.disk',      { top_dirs: 5 },   ctx),
    dispatch('vps.dns_check', { domain },        ctx),
    dispatch('vps.tls_check', { domain },        ctx),
  ]);

  const evidence = {
    status:    settleToValue(statusR),
    disk:      settleToValue(diskR),
    dns_check: settleToValue(dnsR),
    tls_check: settleToValue(tlsR),
  };

  const prompt = buildPrompt(conn.label, conn.host, domain, evidence);

  try {
    const r = await runAiTool(admin, body.tenant_id, userId, 'vps_status', prompt, {
      metadata: { connection_id: conn.id, domain, source: 'kodee-diagnose' },
    });
    return json({
      ok: true,
      run_id: r.runId,
      diagnosis: r.output,
      evidence,
      tokens: { input: r.inputTokens, output: r.outputTokens, cached: r.cachedTokens },
      cost_usd: r.costUsd,
      duration_ms: r.durationMs,
    });
  } catch (e) {
    if (e instanceof AiInvokeError) {
      return jsonError(e.status, e.code, e.message, e.details);
    }
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

function settleToValue<T>(r: PromiseSettledResult<T>): T | { error: string } {
  return r.status === 'fulfilled' ? r.value : { error: r.reason?.message ?? String(r.reason) };
}

function buildPrompt(label: string, host: string, domain: string, evidence: Record<string, unknown>): string {
  return [
    `# VPS Diagnose-Anfrage`,
    ``,
    `Verbindung: **${label}** (\`${host}\`)`,
    `Geprüfte Domain: **${domain}**`,
    ``,
    `## Erhobene Evidenz`,
    ``,
    '```json',
    JSON.stringify(evidence, null, 2),
    '```',
    ``,
    `## Aufgabe`,
    `Schreibe eine knappe Gesamt-Diagnose auf Deutsch in Markdown:`,
    `1. **Was läuft** (max. 3 Punkte)`,
    `2. **Was nicht läuft / auffällig ist** (max. 5 Punkte)`,
    `3. **Nächste Schritte** (max. 5 konkrete Befehle / Aktionen)`,
    ``,
    `Wenn ein Evidence-Feld einen \`error\` enthält, weise darauf hin, statt zu raten.`,
  ].join('\n');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return json({ ok: false, error: { code, message, details } }, status);
}
