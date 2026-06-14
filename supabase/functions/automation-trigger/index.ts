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
//   5. If skill.n8n_workflow_id is set: POST n8n webhook (async — n8n calls
//      back via automation-callback). Otherwise: mark run 'error'/NOT_CONNECTED
//      — the skill exists in the catalog but is not yet wired to n8n.
//   6. Return { run_id }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';
import { getCurrentTotal } from '../_shared/usage.ts';

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
  }).select('id').single();
  if (runErr || !run) return jsonError(500, 'INTERNAL', runErr?.message ?? 'run insert failed');

  await admin.from('automation_run_events').insert({
    run_id: run.id,
    event_type: 'queued',
    payload: { skill_id: skill.id },
  });

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return json({ ok: false, error: { code, message, details } }, status);
}
