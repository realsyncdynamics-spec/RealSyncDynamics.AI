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
// PHASE B · Schritt 1: The runner executes the deterministic Deadline-
// Sentinel per tenant — it flags overdue / due-soon governance obligations
// (incidents past their 72h notification deadline, DPIA reviews, DSRs) into
// the agent-OS substrate (agent_observations + agent_events) and surfaces
// severe findings as governance_alerts (visible in /app/alerts). No LLM.
//
// Still stubbed (separate next steps): the LLM-driven Hermes daily brief and
// the Monitoring SLO agent — their report fields stay 0/false for now.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { runDeadlineSentinelForTenant } from '../_shared/agents/deadlineSentinelRunner.ts';
import { generateGovernanceBriefForTenant } from '../_shared/agents/governanceBriefRunner.ts';

interface RequestBody {
  cadence?:    'hourly' | 'daily';
  tenant_ids?: string[];
}

function jsonError(status: number, code: string, detail: string): Response {
  return jsonResponse({ error: { code, detail } }, status);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
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
  const now = new Date();

  // PHASE B · Schritt 1 — Deadline-Sentinel (deterministisch, kein LLM):
  // flaggt überfällige/fristnahe Pflichten pro Tenant ins Agent-OS-Substrat
  // (agent_observations + agent_events) und macht schwere Funde als
  // governance_alerts sichtbar. Hermes-/Monitoring-Agenten folgen als
  // eigene Schritte (heute bewusst 0/false).
  const tenants = await Promise.all(tenant_ids.map(async (tenant_id) => {
    try {
      const sentinel = await runDeadlineSentinelForTenant(admin, tenant_id, now);

      // PHASE B · Schritt 2 — Hermes Governance-Brief (LLM, nur daily).
      // Fehler dürfen den Sentinel-Lauf nicht abbrechen.
      let hermes_brief_created = false;
      let hermes_brief_id: string | null = null;
      if (cadence === 'daily') {
        try {
          const brief = await generateGovernanceBriefForTenant(admin, tenant_id, now);
          if (brief) { hermes_brief_created = true; hermes_brief_id = brief.id; }
        } catch (e) {
          sentinel.errors.push(`brief_failed: ${(e as Error)?.message ?? String(e)}`);
        }
      }

      return {
        tenant_id,
        hermes_brief_created,
        hermes_brief_id,
        monitoring_slos_evaluated: 0,
        monitoring_slos_breached:  0,
        decision_overdue_flagged:  sentinel.decision_overdue_flagged,
        alerts_created:            sentinel.alerts_created,
        errors:                    sentinel.errors,
      };
    } catch (e) {
      return {
        tenant_id,
        hermes_brief_created:      false,
        hermes_brief_id:           null,
        monitoring_slos_evaluated: 0,
        monitoring_slos_breached:  0,
        decision_overdue_flagged:  0,
        alerts_created:            0,
        errors:                    [`sentinel_failed: ${(e as Error)?.message ?? String(e)}`],
      };
    }
  }));

  const report = {
    cadence,
    started_at,
    completed_at:  new Date().toISOString(),
    duration_ms:   Date.now() - t0,
    tenants,
    total_errors:  tenants.reduce((n, t) => n + t.errors.length, 0),
    phase:         'B_RUNTIME',
  };

  return jsonResponse(report);
});
