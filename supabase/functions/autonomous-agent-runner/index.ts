// Autonomous Agent Runner
// Bridges the UI-facing autonomous_agents / autonomous_agent_runs tables
// to the existing enterprise agent execution logic.
//
// POST /functions/v1/autonomous-agent-runner
// Authorization: Bearer <user JWT>  (or service_role for cron)
// Body:
//   { run_id: string }                    – process one specific pending run
//   { process_pending?: boolean, limit?: number } – drain pending queue (cron)
//
// Flow:
//   1. Load run + agent (tenant-scoped)
//   2. Map agent.type → enterprise agentId
//   3. Execute (same logic as enterprise-ai-os-agents-run)
//   4. Update autonomous_agent_runs (status, output, duration)
//   5. Write autonomous_agent_events + optional autonomous_agent_tasks
//   6. Update autonomous_agents.last_executed_at

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { runEnterpriseAgent, type AgentId, type AgentRunResult } from '../_shared/enterprise-ai-os-agents.ts';

/** Map autonomous agent type → enterprise AgentId */
const TYPE_TO_AGENT_ID: Record<string, AgentId> = {
  governance: 'ai-discovery-agent',
  remediation: 'remediation-agent',
  monitoring: 'audit-agent',
  'compliance-scorer': 'risk-classification-agent',
  'risk-assessor': 'risk-classification-agent',
  custom: 'workflow-agent',
};

interface RunRow {
  id: string;
  agent_id: string;
  tenant_id: string;
  status: string;
  triggered_by: string;
  input_params: Record<string, unknown> | null;
  retry_count: number;
  max_retries: number;
}

interface AgentRow {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  parameters: Record<string, unknown> | null;
}

async function processOneRun(
  supabase: SupabaseClient,
  run: RunRow,
  agent: AgentRow,
  actor: string,
): Promise<{ ok: boolean; status: string; summary: string; result?: AgentRunResult }> {
  if (!agent.enabled) {
    await supabase
      .from('autonomous_agent_runs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Agent is disabled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    return { ok: false, status: 'cancelled', summary: 'Agent disabled' };
  }

  const agentId = TYPE_TO_AGENT_ID[agent.type] ?? 'workflow-agent';
  const started = Date.now();

  // Mark running
  await supabase
    .from('autonomous_agent_runs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  let result: AgentRunResult;
  try {
    result = runEnterpriseAgent({
      agentId,
      tenantId: agent.tenant_id,
      actor,
      payload: {
        ...(agent.parameters ?? {}),
        ...(run.input_params ?? {}),
        ...(agent.config ?? {}),
        autonomous_agent_id: agent.id,
        autonomous_run_id: run.id,
        agent_name: agent.name,
        agent_type: agent.type,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'execution_failed';
    const duration = Date.now() - started;
    await supabase
      .from('autonomous_agent_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    await supabase.from('autonomous_agent_events').insert({
      agent_id: agent.id,
      tenant_id: agent.tenant_id,
      event_type: 'error',
      description: `Run failed: ${msg}`,
      related_run_id: run.id,
    });

    return { ok: false, status: 'failed', summary: msg };
  }

  const duration = Date.now() - started;
  const finalStatus =
    result.status === 'error'
      ? 'failed'
      : result.status === 'requires_approval' || result.status === 'blocked'
        ? 'completed'
        : 'completed';

  await supabase
    .from('autonomous_agent_runs')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      output: {
        enterprise_agent_id: result.agentId,
        enterprise_status: result.status,
        summary: result.summary,
        findings: result.findings,
        recommendations: result.recommendations,
        auditEvents: result.auditEvents,
        metadata: result.metadata,
      },
      error_message: result.status === 'error' ? result.summary : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  // Touch last_executed_at
  await supabase
    .from('autonomous_agents')
    .update({ last_executed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', agent.id);

  // Event
  await supabase.from('autonomous_agent_events').insert({
    agent_id: agent.id,
    tenant_id: agent.tenant_id,
    event_type: 'executed',
    description: result.summary,
    related_run_id: run.id,
    changes: { enterprise_status: result.status, duration_ms: duration },
  });

  // Optional tasks from recommendations that require human approval
  const approvalRecs = (result.recommendations || []).filter(
    (r: Record<string, unknown>) => r.requiresHumanApproval === true,
  );
  if (approvalRecs.length > 0) {
    const tasks = approvalRecs.slice(0, 5).map((r: Record<string, unknown>) => ({
      agent_id: agent.id,
      agent_run_id: run.id,
      tenant_id: agent.tenant_id,
      title: String(r.title || 'Approval required'),
      description: String(r.description || ''),
      task_type: 'approval',
      priority:
        String(r.priority || 'medium') === 'urgent' ? 'critical' : String(r.priority || 'medium'),
      status: 'open',
      metadata: { source: 'autonomous-agent-runner', recommendation_id: r.id },
    }));
    await supabase.from('autonomous_agent_tasks').insert(tasks);
  }

  return { ok: true, status: finalStatus, summary: result.summary, result };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions(req);
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', corsHeaders);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      run_id?: string;
      process_pending?: boolean;
      limit?: number;
      tenantId?: string;
    };

    const auth = await requireAuthAndTenant(
      req,
      typeof body.tenantId === 'string' ? body.tenantId : undefined,
    );
    if (auth instanceof Response) return auth;

    const supabase = auth.admin;
    const tenantId = auth.tenantId;
    const actor = auth.user?.id ? `user:${auth.user.id}` : 'system';

    // Mode 1: single run_id
    if (body.run_id) {
      const { data: run, error: runErr } = await supabase
        .from('autonomous_agent_runs')
        .select('*')
        .eq('id', body.run_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (runErr || !run) {
        return jsonError(404, 'NOT_FOUND', 'Run not found or not in tenant', corsHeaders);
      }
      if (run.status !== 'pending' && run.status !== 'running') {
        return jsonResponse(
          { ok: false, reason: 'run_not_pending', status: run.status },
          200,
          corsHeaders,
        );
      }

      const { data: agent, error: agentErr } = await supabase
        .from('autonomous_agents')
        .select('*')
        .eq('id', run.agent_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (agentErr || !agent) {
        return jsonError(404, 'NOT_FOUND', 'Agent not found', corsHeaders);
      }

      const outcome = await processOneRun(supabase, run as RunRow, agent as AgentRow, actor);
      return jsonResponse(outcome, 200, corsHeaders);
    }

    // Mode 2: drain pending (for cron / bulk)
    if (body.process_pending) {
      const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
      const { data: pending, error } = await supabase
        .from('autonomous_agent_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        return jsonError(500, 'DB_ERROR', error.message, corsHeaders);
      }

      const results = [];
      for (const run of pending || []) {
        const { data: agent } = await supabase
          .from('autonomous_agents')
          .select('*')
          .eq('id', run.agent_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!agent) continue;
        const outcome = await processOneRun(supabase, run as RunRow, agent as AgentRow, actor);
        results.push({ run_id: run.id, ...outcome });
      }

      return jsonResponse({ processed: results.length, results }, 200, corsHeaders);
    }

    return jsonError(400, 'BAD_REQUEST', 'Provide run_id or process_pending: true', corsHeaders);
  } catch (err) {
    console.error('autonomous-agent-runner error:', err);
    return jsonError(
      500,
      'INTERNAL',
      err instanceof Error ? err.message : 'Unknown error',
      corsHeaders,
    );
  }
});
