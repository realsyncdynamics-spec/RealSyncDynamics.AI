// Kodee VPS Action Advisor — pre-flight risk assessment for write actions.
//
// POST /functions/v1/kodee-advise
// Authorization: Bearer <user JWT>
// Body: { tenant_id, connection_id, action, args }
//
// 1. Auth + tenant membership.
// 2. loadConnectionForUser (owner-or-tenant-member).
// 3. Optionally collect a thin SSH context for the targeted unit / compose dir
//    (best-effort, errors don't abort).
// 4. runAiTool('vps_action_advisor', prompt) — produces a Markdown verdict.
// 5. Return { advice, evidence, tokens, cost_usd }.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runAiTool, AiInvokeError } from '../_shared/ai.ts';
import { loadConnectionForUser } from '../_shared/connections.ts';
import { decryptPrivateKey } from '../kodee/secrets.ts';
import { sshExec, shellQuote } from '../kodee/ssh.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPPORTED_ACTIONS = new Set([
  'vps.service.restart', 'vps.compose.up', 'vps.compose.restart',
]);

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

  let body: { tenant_id?: string; connection_id?: string; action?: string; args?: Record<string, unknown> };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.tenant_id || !body.connection_id || !body.action) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, connection_id, action required');
  }
  if (!SUPPORTED_ACTIONS.has(body.action)) {
    return jsonError(400, 'BAD_REQUEST', `action ${body.action} is not advisable (only write actions)`);
  }

  // Tenant membership check via RLS
  const { data: member, error: memberErr } = await userClient
    .from('memberships').select('id')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const conn = await loadConnectionForUser(admin, userId, body.connection_id);
  if (!conn) return jsonError(404, 'NOT_FOUND', 'connection not found');

  const args = body.args ?? {};

  // Best-effort context fetch
  let evidence: Record<string, unknown> = { action: body.action, args };
  try {
    const { data: keyRow } = await admin
      .from('vps_ssh_keys').select('encrypted_private_key')
      .eq('connection_id', conn.id).maybeSingle<{ encrypted_private_key: string }>();
    if (keyRow) {
      const privateKey = await decryptPrivateKey(keyRow.encrypted_private_key);
      evidence = await collectContext(conn, privateKey, body.action, args, evidence);
    } else {
      evidence.context_error = 'ssh key missing';
    }
  } catch (e) {
    evidence.context_error = (e as Error).message;
  }

  const prompt = buildPrompt(conn.label, conn.host, body.action, args, evidence);

  try {
    const r = await runAiTool(admin, body.tenant_id, userId, 'vps_action_advisor', prompt, {
      metadata: { connection_id: conn.id, action: body.action, source: 'kodee-advise' },
    });
    return json({
      ok: true,
      run_id: r.runId,
      advice: r.output,
      evidence,
      tokens: { input: r.inputTokens, output: r.outputTokens, cached: r.cachedTokens },
      cost_usd: r.costUsd,
      duration_ms: r.durationMs,
    });
  } catch (e) {
    if (e instanceof AiInvokeError) return jsonError(e.status, e.code, e.message, e.details);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function collectContext(
  conn: any, key: string, action: string, args: Record<string, unknown>, base: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const evidence = { ...base };
  try {
    if (action === 'vps.service.restart' && typeof args.service === 'string') {
      const { stdout } = await sshExec(conn, key,
        `systemctl status --no-pager ${shellQuote(args.service)} 2>&1 | head -n 20 || true`,
        { timeoutMs: 10_000 });
      evidence.service_status = stdout.split('\n').filter(Boolean);
    } else if (typeof args.compose_dir === 'string') {
      const { stdout } = await sshExec(conn, key,
        `cd ${shellQuote(args.compose_dir)} && (docker compose ps 2>&1 || docker-compose ps 2>&1) | head -n 30`,
        { timeoutMs: 15_000 });
      evidence.compose_ps = stdout.split('\n').filter(Boolean);
    }
    const { stdout: uptime } = await sshExec(conn, key, 'uptime', { timeoutMs: 5_000 });
    evidence.uptime = uptime.trim();
  } catch (e) {
    evidence.context_error = (e as Error).message;
  }
  return evidence;
}

function buildPrompt(label: string, host: string, action: string, args: Record<string, unknown>, evidence: Record<string, unknown>): string {
  return [
    `# Geplante Aktion`,
    ``,
    `Verbindung: **${label}** (\`${host}\`)`,
    `Aktion: \`${action}\``,
    `Args: \`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\``,
    ``,
    `## Kontext (live vom Server)`,
    '```json',
    JSON.stringify(evidence, null, 2),
    '```',
    ``,
    `Bewerte die Aktion gemäß deiner System-Anweisung.`,
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
