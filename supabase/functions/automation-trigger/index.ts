// Automation Skill trigger — entry point for Phase-2 Automatisierungs-Skills.
//
// POST /functions/v1/automation-trigger
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, skill_id: string, input?: object }
//
// Pipeline:
//   1. JWT verify + tenant membership
//   2. Load skill from automation_skills + status/plan checks
//   3. gateFeature('ai.tool.automations') + quota check (limit.automation_runs_monthly)
//   4. INSERT automation_runs (status='queued') + 'queued' event
//   5. DIRECT_SKILL_HANDLERS: Skills mit eingebauter Direct-Execution (kein n8n
//      nötig, z. B. dsgvo-audit → ruft gdpr-audit synchron auf) laufen sofort
//      durch und liefern result inline zurück.
//   6. Sonst: wenn skill.n8n_workflow_id gesetzt ist, POST n8n webhook (async —
//      n8n calls back via automation-callback). Andernfalls: mark run
//      'error'/NOT_CONNECTED — der Skill existiert im Katalog, ist aber noch
//      nicht mit n8n verbunden.
//   7. Return { run_id }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { getCurrentTotal, recordUsage } from '../_shared/usage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// PlanKey rank — must match src/core/billing/types.ts PlanKey order.
const PLAN_RANK: Record<string, number> = {
  free: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  enterprise_public: 4,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const N8N_INTERNAL_URL = Deno.env.get('N8N_INTERNAL_URL') ?? 'https://n8n.realsyncdynamicsai.de';
  const AUTOMATION_CALLBACK_SECRET = Deno.env.get('AUTOMATION_CALLBACK_SECRET');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: { tenant_id?: string; skill_id?: string; input?: Record<string, unknown> };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }
  if (!body.tenant_id || !body.skill_id) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id and skill_id required');
  }

  const { data: member, error: memberErr } = await userClient
    .from('memberships').select('id')
    .eq('tenant_id', body.tenant_id).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!member)   return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: skill, error: skillErr } = await admin
    .from('automation_skills').select('*')
    .eq('id', body.skill_id).maybeSingle();
  if (skillErr) return jsonError(500, 'INTERNAL', skillErr.message);
  if (!skill) return jsonError(404, 'NOT_FOUND', 'skill not found');
  if (skill.status === 'planned') {
    return jsonError(409, 'NOT_IMPLEMENTED', `skill "${skill.id}" is not yet available`);
  }

  // Entitlement gate (boolean feature)
  try {
    await gateFeature(admin, body.tenant_id, 'ai.tool.automations');
  } catch (e) {
    if (e instanceof EntitlementError) return jsonError(403, e.code, e.message);
    throw e;
  }

  // Plan-rank check (per-skill required_plan vs. tenant's resolved plan_key)
  const { data: sub } = await admin
    .from('subscriptions').select('plan_key')
    .eq('tenant_id', body.tenant_id)
    .order('updated_at', { ascending: false })
    .limit(1).maybeSingle();
  const tenantPlan = sub?.plan_key ?? 'free';
  const tenantRank = PLAN_RANK[tenantPlan] ?? 0;
  const requiredRank = PLAN_RANK[skill.required_plan] ?? 0;
  if (tenantRank < requiredRank) {
    return jsonError(403, 'PLAN_REQUIRED',
      `skill "${skill.id}" requires plan "${skill.required_plan}" (tenant is on "${tenantPlan}")`);
  }

  // Quota check (monthly run limit)
  const [currentRuns, entResp] = await Promise.all([
    getCurrentTotal(admin, body.tenant_id, 'limit.automation_runs_monthly'),
    admin.rpc('tenant_entitlements', { p_tenant_id: body.tenant_id }),
  ]);
  // deno-lint-ignore no-explicit-any
  const limits = Object.fromEntries(((entResp.data ?? []) as any[]).map((r) => [r.key, r.value as number]));
  const runsLimit = limits['limit.automation_runs_monthly'];
  if (typeof runsLimit === 'number' && runsLimit !== -1 && currentRuns + 1 > runsLimit) {
    return jsonError(402, 'QUOTA_EXCEEDED',
      `monthly automation run quota reached (${currentRuns}/${runsLimit})`);
  }

  // Insert queued run
  const { data: run, error: runErr } = await admin.from('automation_runs').insert({
    tenant_id: body.tenant_id,
    skill_id: skill.id,
    triggered_by: userId,
    status: 'queued',
    input: body.input ?? {},
  }).select('id, started_at').single();
  if (runErr || !run) return jsonError(500, 'INTERNAL', runErr?.message ?? 'run insert failed');

  await admin.from('automation_run_events').insert({
    run_id: run.id,
    event_type: 'queued',
    payload: { skill_id: skill.id },
  });

  if (skill.id === 'dsgvo-audit') {
    return await runDsgvoAuditDirect(admin, SUPABASE_URL, run, body, userResp.user.email ?? null);
  }

  if (!skill.n8n_workflow_id) {
    await admin.from('automation_runs').update({
      status: 'error',
      error_code: 'NOT_CONNECTED',
      error_message: `skill "${skill.id}" is not yet connected to an n8n workflow`,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    await admin.from('automation_run_events').insert({
      run_id: run.id,
      event_type: 'error',
      payload: { error_code: 'NOT_CONNECTED' },
    });
    return jsonError(503, 'NOT_CONNECTED', `skill "${skill.id}" is not yet connected to an n8n workflow`, { run_id: run.id });
  }

  const callbackUrl = `${SUPABASE_URL}/functions/v1/automation-callback`;
  const webhookUrl = `${N8N_INTERNAL_URL.replace(/\/$/, '')}/webhook/${skill.n8n_workflow_id}`;

  let n8nExecutionId: string | null = null;
  try {
    const n8nResp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: run.id,
        callback_url: callbackUrl,
        callback_secret: AUTOMATION_CALLBACK_SECRET,
        tenant_id: body.tenant_id,
        skill_id: skill.id,
        input: body.input ?? {},
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!n8nResp.ok) {
      const errBody = await n8nResp.text().catch(() => '');
      await admin.from('automation_runs').update({
        status: 'error',
        error_code: 'N8N_REJECTED',
        error_message: `n8n returned ${n8nResp.status}: ${errBody.slice(0, 200)}`,
        finished_at: new Date().toISOString(),
      }).eq('id', run.id);
      return jsonError(502, 'N8N_REJECTED', `n8n returned ${n8nResp.status}`, { run_id: run.id });
    }
    // deno-lint-ignore no-explicit-any
    const ack: any = await n8nResp.json().catch(() => ({}));
    n8nExecutionId = ack?.executionId ?? null;
  } catch (e) {
    await admin.from('automation_runs').update({
      status: 'error',
      error_code: 'N8N_UNREACHABLE',
      error_message: (e as Error).message,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    return jsonError(503, 'N8N_UNREACHABLE', `n8n unreachable: ${(e as Error).message}`, { run_id: run.id });
  }

  await admin.from('automation_runs').update({
    status: 'running',
    n8n_execution_id: n8nExecutionId,
  }).eq('id', run.id);
  await admin.from('automation_run_events').insert({
    run_id: run.id,
    event_type: 'running',
    payload: { n8n_execution_id: n8nExecutionId },
  });

  return json({ ok: true, run_id: run.id, n8n_execution_id: n8nExecutionId });
});

// ─── Direct-Execution: dsgvo-audit ──────────────────────────────────────────
// Ruft die bestehende, öffentliche `gdpr-audit`-Function synchron auf — kein
// n8n nötig. Der Run wird sofort als 'success'/'error' abgeschlossen, das
// Ergebnis als automation_outputs (output_type='report') gespeichert und
// inline zurückgegeben.
async function runDsgvoAuditDirect(
  admin: ReturnType<typeof createClient>,
  SUPABASE_URL: string,
  run: { id: string; started_at: string },
  body: { tenant_id?: string; input?: Record<string, unknown> },
  userEmail: string | null,
): Promise<Response> {
  const url = typeof body.input?.url === 'string' ? body.input.url.trim() : '';
  if (!url) {
    await failRun(admin, run.id, 'BAD_REQUEST', 'input.url required for skill "dsgvo-audit"');
    return jsonError(400, 'BAD_REQUEST', 'input.url required for skill "dsgvo-audit"', { run_id: run.id });
  }
  if (!userEmail) {
    await failRun(admin, run.id, 'NO_EMAIL', 'user account has no email address');
    return jsonError(400, 'NO_EMAIL', 'user account has no email address', { run_id: run.id });
  }

  // deno-lint-ignore no-explicit-any
  let data: any;
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, email: userEmail, source: 'automation_skill' }),
      signal: AbortSignal.timeout(20_000),
    });
    data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      const msg = data?.error?.message ?? `gdpr-audit returned ${resp.status}`;
      await failRun(admin, run.id, 'AUDIT_FAILED', msg);
      return jsonError(502, 'AUDIT_FAILED', msg, { run_id: run.id });
    }
  } catch (e) {
    await failRun(admin, run.id, 'AUDIT_UNREACHABLE', (e as Error).message);
    return jsonError(503, 'AUDIT_UNREACHABLE', (e as Error).message, { run_id: run.id });
  }

  const result = {
    audit_id: data.audit_id,
    score: data.score,
    severity: data.severity,
    domain: data.domain,
    issues: data.issues,
    coverage: data.coverage,
    coverage_notice: data.coverage_notice,
  };

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - new Date(run.started_at).getTime();

  await admin.from('automation_runs').update({
    status: 'success',
    result,
    cost_usd: 0,
    duration_ms: durationMs,
    finished_at: finishedAt.toISOString(),
  }).eq('id', run.id);
  await admin.from('automation_run_events').insert({
    run_id: run.id,
    event_type: 'success',
    payload: {},
  });
  await admin.from('automation_outputs').insert({
    run_id: run.id,
    tenant_id: body.tenant_id,
    output_type: 'report',
    content: result,
  });

  try {
    await recordUsage(admin, body.tenant_id!, 'limit.automation_runs_monthly', 1, {
      run_id: run.id, skill_id: 'dsgvo-audit',
    });
  } catch (e) {
    console.error('recordUsage failed', (e as Error).message);
  }

  return json({ ok: true, run_id: run.id, status: 'success', result });
}

async function failRun(
  admin: ReturnType<typeof createClient>,
  runId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await admin.from('automation_runs').update({
    status: 'error',
    error_code: errorCode,
    error_message: errorMessage,
    finished_at: new Date().toISOString(),
  }).eq('id', runId);
  await admin.from('automation_run_events').insert({
    run_id: runId,
    event_type: 'error',
    payload: { error_code: errorCode },
  });
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
