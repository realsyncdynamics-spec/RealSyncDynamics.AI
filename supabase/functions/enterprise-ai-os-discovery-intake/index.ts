// Enterprise AI OS — Discovery Self-Assessment intake.
//
// POST /functions/v1/enterprise-ai-os-discovery-intake
// Body: { tenantId?, actor?, systemName, provider, model?, usageContext?,
//         department?, dataCategories?, externalUsage?, containsPersonalData?,
//         containsSensitiveData?, approved?, comment? }
//
// Persists a new ai_system_registry row (approved=false, risk_level=unknown
// by default), then runs the agent pipeline in this order:
//   1. risk-classification-agent → derives risk_level
//   2. policy-enforcement-agent  → blocks sensitive+external
//   3. audit-agent               → records combined audit event
//
// Each agent run is persisted into enterprise_agent_runs and audit events
// fan out into enterprise_ai_audit_events. The registry row's risk_level
// is updated from the risk-classification result.
//
// Auth: echte Nutzersitzung + schreibende Rolle im genannten Mandanten
// (requireAuthAndTenant, der kanonische Resolver). Vorher ohne jede Prüfung:
// tenantId und actor kamen aus dem Body und flossen in einen Service-Role-
// Client — jeder konnte Register-, Agentenlauf- und Audit-Zeilen in fremde
// Mandanten schreiben. Der Actor ist jetzt die geprüfte Nutzer-ID.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { runEnterpriseAgent, type AgentId } from '../_shared/enterprise-ai-os-agents.ts';
import { handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';

/** Schreibende Mandantenrollen (wie public.is_tenant_writer) — nicht viewer_auditor. */
const WRITER_ROLES = ['owner', 'admin', 'dpo', 'editor'];

interface IntakeBody {
  tenantId?: string;
  systemName: string;
  provider: string;
  model?: string;
  usageContext?: string;
  department?: string;
  dataCategories?: string[];
  externalUsage?: boolean;
  containsPersonalData?: boolean;
  containsSensitiveData?: boolean;
  approved?: boolean;
  comment?: string;
}

async function persistRun(
  sb: SupabaseClient,
  agentId: AgentId,
  tenantId: string,
  actor: string,
  payload: Record<string, unknown>,
) {
  const result = runEnterpriseAgent({ agentId, tenantId, actor, payload });

  const { data: runRow, error: runErr } = await sb
    .from('enterprise_agent_runs')
    .insert({
      tenant_id: tenantId,
      agent_id: agentId,
      actor,
      input_payload: payload,
      status: result.status,
      summary: result.summary,
      findings: result.findings,
      recommendations: result.recommendations,
      audit_events: result.auditEvents,
      metadata: result.metadata,
    })
    .select('id')
    .single();

  const runId = (runRow as { id: string } | null)?.id ?? null;

  if (!runErr && result.auditEvents.length > 0) {
    const rows = result.auditEvents.map((ev) => ({
      tenant_id: tenantId,
      actor: ev.actor as string,
      action: ev.action as string,
      system_name: (ev.systemName as string | null) ?? null,
      risk_level: (ev.riskLevel as string | null) ?? null,
      metadata: {
        ...(ev.metadata as Record<string, unknown>),
        agent_run_id: runId,
        source_agent: agentId,
      },
    }));
    await sb.from('enterprise_ai_audit_events').insert(rows);
  }

  return { ...result, run_id: runId };
}

function validateIntake(body: IntakeBody): string | null {
  const text = (v: unknown, max: number, required: boolean): boolean =>
    v === undefined || v === null
      ? !required
      : typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);
  if (!text(body.systemName, 200, true) || !text(body.provider, 200, true)) {
    return 'systemName and provider are required (max 200 chars)';
  }
  if (!text(body.model, 200, false) || !text(body.department, 200, false)) return 'model/department: max 200 chars';
  if (!text(body.usageContext, 2000, false) || !text(body.comment, 2000, false)) {
    return 'usageContext/comment: max 2000 chars';
  }
  const categories = body.dataCategories;
  if (categories !== undefined && (
    !Array.isArray(categories) || categories.length > 20
    || categories.some((c) => typeof c !== 'string' || !/^[a-z_]{1,64}$/.test(c))
  )) {
    return 'dataCategories: up to 20 identifiers';
  }
  return null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  let body: IntakeBody;
  try {
    body = (await req.json()) as IntakeBody;
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  // Autorisierung vor jeder Wirkung; danach ist auth.tenantId die einzige
  // Mandanten-Autorität und auth.admin der einzige Service-Role-Client.
  const auth = await requireAuthAndTenant(req, body?.tenantId, WRITER_ROLES);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  const sb = auth.admin;
  const actor = `user:${auth.user.id}`;

  const invalid = validateIntake(body);
  if (invalid) return jsonResponse({ error: invalid }, 400);

  // 1. Insert registry row (always approved=false on intake; admin must approve).
  const { data: registryRow, error: regErr } = await sb
    .from('enterprise_ai_system_registry')
    .insert({
      tenant_id: tenantId,
      name: body.systemName,
      provider: body.provider,
      model: body.model ?? null,
      usage_context: body.usageContext ?? null,
      department: body.department ?? null,
      data_categories: body.dataCategories ?? [],
      external_usage: Boolean(body.externalUsage),
      contains_personal_data: Boolean(body.containsPersonalData),
      contains_sensitive_data: Boolean(body.containsSensitiveData),
      approved: false,
      comment: body.comment ?? null,
      intake_source: 'self_assessment',
      risk_level: 'unknown',
    })
    .select()
    .single();

  if (regErr) {
    // Datenbankmeldungen nicht an den Aufrufer.
    console.error('[discovery-intake] registry insert failed', regErr.code ?? 'unknown');
    return jsonResponse({ error: 'registry insert failed' }, 500);
  }
  const registry = registryRow as Record<string, unknown>;
  const registryId = registry.id as string;

  // 2. Run risk-classification-agent.
  const riskRun = await persistRun(sb, 'risk-classification-agent', tenantId, actor, {
    systemName: body.systemName,
    dataCategories: body.dataCategories ?? [],
    usageContext: body.usageContext ?? '',
    registryId,
  });
  const newRiskLevel = (riskRun.metadata?.riskLevel as string | undefined) ?? 'unknown';

  // 3. Update registry risk_level from the classification (approval stays false).
  await sb
    .from('enterprise_ai_system_registry')
    .update({ risk_level: newRiskLevel, updated_at: new Date().toISOString() })
    .eq('id', registryId);

  // 4. Run policy-enforcement-agent on the declared usage (model + data + external).
  const policyRun = await persistRun(sb, 'policy-enforcement-agent', tenantId, actor, {
    systemName: body.systemName,
    model: body.model ?? body.provider,
    dataCategories: body.dataCategories ?? [],
    externalAction: Boolean(body.externalUsage),
    riskLevel: newRiskLevel,
    policy: {
      allowed_models: [],
      forbidden_data_categories: ['payroll_data', 'health_data', 'sensitive_data'],
      requires_human_approval: true,
      external_actions_allowed: false,
    },
    registryId,
  });

  // 5. Run audit-agent to record the combined intake event.
  const auditRun = await persistRun(sb, 'audit-agent', tenantId, actor, {
    action: 'discovery_intake',
    systemName: body.systemName,
    riskLevel: newRiskLevel,
    metadata: {
      registryId,
      policyStatus: policyRun.status,
      riskRunId: riskRun.run_id,
      policyRunId: policyRun.run_id,
    },
  });

  return jsonResponse({
    ok: true,
    registry: { ...registry, risk_level: newRiskLevel },
    runs: {
      risk: { id: riskRun.run_id, status: riskRun.status, riskLevel: newRiskLevel },
      policy: { id: policyRun.run_id, status: policyRun.status },
      audit: { id: auditRun.run_id, status: auditRun.status },
    },
  }, 200);
});
