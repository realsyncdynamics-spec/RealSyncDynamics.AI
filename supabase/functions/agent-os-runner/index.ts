// Agent OS Runner — periodic cron entry point for the multi-agent OS.
//
// POST /functions/v1/agent-os-runner
//   verify_jwt = false; auth via Bearer secret (Vault: agent_os_runner_token)
//
// Body:
//   { cadence?: 'hourly' | 'daily', tenant_ids?: string[] }
//
// Behavior:
//   - cadence defaults to 'hourly'.
//   - tenant_ids defaults to ALL tenants from public.tenants.
//
// PHASE-A SCAFFOLDING: The runner currently has nothing persistent to
// run against — agent state lives in process memory in the Phase-A
// classes (HermesAgent, MonitoringAgent, DecisionAgent). Until Phase B
// Postgres adapters land, this endpoint exists to:
//   1. validate the cron-auth pattern (Bearer secret from Vault)
//   2. provide the URL that pg_cron will hit
//   3. produce a structured RunReport-shaped response so observers
//      can wire dashboards now
//
// The actual agent imports are commented out and reactivated when the
// Phase B adapters exist. Today the response is a stub report listing
// the tenants the runner WOULD have processed.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  cadence?:    'hourly' | 'daily';
  tenant_ids?: string[];
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string, detail: string): Response {
  return json(status, { error: { code, detail } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const SUPABASE_URL              = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(500, 'NOT_CONFIGURED', 'env missing');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Bearer auth via Vault (re-uses the get_app_secret RPC pattern
  // already shared by ai-invoke / sales-lead / market-scanner).
  const { data: token, error: secretErr } = await admin
    .rpc('get_app_secret', { secret_name: 'agent_os_runner_token' });
  if (secretErr || !token) {
    return jsonError(500, 'NOT_CONFIGURED', `vault token missing: ${secretErr?.message ?? 'empty'}`);
  }
  const expected = `Bearer ${token}`;
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== expected) return jsonError(401, 'UNAUTHORIZED', 'invalid bearer');

  let body: RequestBody = {};
  try { body = await req.json(); } catch { /* empty body OK */ }

  const cadence: 'hourly' | 'daily' = body.cadence === 'daily' ? 'daily' : 'hourly';

  // Resolve tenant_ids — from body OR from public.tenants.
  let tenant_ids: string[] = (body.tenant_ids ?? []).filter(t => typeof t === 'string');
  if (tenant_ids.length === 0) {
    const { data, error } = await admin.from('tenants').select('id');
    if (error) return jsonError(500, 'TENANTS_QUERY_FAILED', error.message);
    tenant_ids = (data ?? []).map((r: { id: string }) => r.id);
  }

  const started_at = new Date().toISOString();
  const t0 = Date.now();

  // PHASE-A SCAFFOLDING ONLY. The actual Phase-B implementation will:
  //
  //   import { HermesAgent }     from '../../../src/core/hermes-agent/hermes';
  //   import { MonitoringAgent } from '../../../src/core/monitoring-agent/monitoring';
  //   import { DecisionAgent }   from '../../../src/core/decision-agent/decision';
  //   import { AgentOsStore }    from '../../../src/core/agent-os/store';
  //   import { runHourly, runDaily }
  //     from '../../../src/core/orchestrator-runner/runner';
  //
  //   const store      = new AgentOsStore({ persistHook: postgresStoreHook(admin) });
  //   const hermes     = new HermesAgent();      hermes.setPersistHook(...);
  //   const monitoring = new MonitoringAgent();  monitoring.setPersistHook(...);
  //   const decision   = new DecisionAgent();    decision.setPersistHook(...);
  //
  //   const fn = cadence === 'daily' ? runDaily : runHourly;
  //   const report = await fn({ hermes, monitoring, decision, store }, { tenant_ids });
  //
  // Until those adapters exist, return a stub report so the cron
  // endpoint is exercisable end-to-end.

  const report = {
    cadence,
    started_at,
    completed_at:  new Date().toISOString(),
    duration_ms:   Date.now() - t0,
    tenants: tenant_ids.map(tenant_id => ({
      tenant_id,
      hermes_brief_created:      false,
      hermes_brief_id:           null,
      monitoring_slos_evaluated: 0,
      monitoring_slos_breached:  0,
      decision_overdue_flagged:  0,
      errors:                    ['phase_a_scaffold: agent persistence not yet wired'],
    })),
    total_errors:  tenant_ids.length,
    phase:         'A_SCAFFOLD',
  };

  return json(200, report);
});
