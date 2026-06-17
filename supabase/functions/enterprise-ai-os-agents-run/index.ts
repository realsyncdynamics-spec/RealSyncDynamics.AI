// Enterprise AI OS — dispatcher to run a single agent by id + persist.
//
// POST /functions/v1/enterprise-ai-os-agents-run
// Body: { agentId, tenantId?, actor?, payload }
//
// Runs the agent, persists the run into enterprise_agent_runs, writes
// each audit event into enterprise_ai_audit_events. Returns the same
// AgentRunResult shape as before plus a `run_id` field.
//
// Pure dispatcher (no DB calls) is still available via the run logic in
// _shared/enterprise-ai-os-agents.ts — this endpoint adds persistence.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runEnterpriseAgent, type AgentId } from '../_shared/enterprise-ai-os-agents.ts';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  let body: { agentId?: string; tenantId?: string; actor?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  if (!body.agentId) return jsonResponse({ error: 'agentId is required' }, 400);

  const input = {
    agentId: body.agentId as AgentId,
    tenantId: body.tenantId,
    actor: body.actor || 'system',
    payload: body.payload || {},
  };

  const result = runEnterpriseAgent(input);

  // Persist run + audit events. Failures are logged into metadata but do
  // NOT fail the request: agent semantics stay deterministic regardless
  // of DB availability.
  let runId: string | null = null;
  let persistError: string | null = null;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (url && serviceKey) {
    try {
      const sb = createClient(url, serviceKey);

      const { data: runRow, error: runErr } = await sb
        .from('enterprise_agent_runs')
        .insert({
          tenant_id: input.tenantId ?? null,
          agent_id: input.agentId,
          actor: input.actor,
          input_payload: input.payload,
          status: result.status,
          summary: result.summary,
          findings: result.findings,
          recommendations: result.recommendations,
          audit_events: result.auditEvents,
          metadata: result.metadata,
        })
        .select('id')
        .single();

      if (runErr) {
        persistError = runErr.message;
      } else {
        runId = (runRow as { id: string } | null)?.id ?? null;
      }

      if (result.auditEvents.length > 0) {
        const auditRows = result.auditEvents.map((ev) => ({
          tenant_id: input.tenantId ?? null,
          actor: ev.actor as string,
          action: ev.action as string,
          system_name: (ev.systemName as string | null) ?? null,
          risk_level: (ev.riskLevel as string | null) ?? null,
          metadata: {
            ...(ev.metadata as Record<string, unknown>),
            agent_run_id: runId,
            source_agent: input.agentId,
          },
        }));

        const { error: auditErr } = await sb
          .from('enterprise_ai_audit_events')
          .insert(auditRows);

        if (auditErr) {
          persistError = persistError ? `${persistError}; ${auditErr.message}` : auditErr.message;
        }
      }
    } catch (e) {
      persistError = (e as Error).message;
    }
  } else {
    persistError = 'Supabase env vars missing on the function; run not persisted.';
  }

  return jsonResponse({ ...result, run_id: runId, persist_error: persistError }, 200);
});
