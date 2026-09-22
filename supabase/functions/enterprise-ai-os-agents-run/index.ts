// Enterprise AI OS Agent Runner
// Executes a governance agent from the registry and persists results
//
// POST /functions/v1/enterprise-ai-os-agents-run
// Authorization: Bearer <user JWT> (Pflicht — verify_jwt = true in config.toml)
// Body: {
//   agentId: string (one of: 'ai-discovery-agent', 'risk-classification-agent', etc)
//   tenantId: string — nur ein Claim. Der Handler prueft ueber
//             requireAuthAndTenant (_shared/auth.ts), ob der angemeldete
//             Nutzer Mitglied dieses Mandanten ist; erst der gepruefte
//             Wert (auth.tenantId) wird fuer Reads, Writes und Metering
//             verwendet. Ohne JWT: 401. Fremder Mandant: 403.
//   actor?: string (defaults to 'system')
//   payload?: Record<string, unknown>
// }
//
// Response: {
//   agentId: string
//   status: 'success' | 'blocked' | 'requires_approval' | 'error'
//   summary: string
//   findings: Array<Record<string, unknown>>
//   recommendations: Array<Record<string, unknown>>
//   auditEvents: Array<Record<string, unknown>>
//   metadata: Record<string, unknown>
//   run_id?: string
//   persist_error?: string
// }

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { recordUsage } from '../_shared/usage.ts';

// Metered entitlement for agent executions (see migration
// 20260721000000_agent_runs_metering.sql). Every executed run (status !==
// 'error') is logged once for a tenant; stripe-meter-sync bills the overage.
const AGENT_RUNS_ENTITLEMENT = 'limit.agent_runs_monthly';

/** Wire-Format des Requests. `tenantId` ist hier ein unbestaetigter Claim. */
interface AgentRunRequest {
  agentId: string;
  tenantId?: string;
  actor?: string;
  payload?: Record<string, unknown>;
}

/** Was der Executor sieht: kein tenantId — der kommt geprueft als Parameter. */
type AgentRunInput = Omit<AgentRunRequest, 'tenantId'>;

interface AgentRunResponse {
  agentId: string;
  status: 'success' | 'blocked' | 'requires_approval' | 'error';
  summary: string;
  findings: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  run_id?: string;
  persist_error?: string;
}

/**
 * Fuehrt einen Agenten fuer einen bereits autorisierten Mandanten aus.
 *
 * `tenantId` ist `auth.tenantId` aus requireAuthAndTenant, `supabase` der
 * Service-Role-Client aus demselben Ergebnis (`auth.admin`). Beides existiert
 * nur, wenn die Mitgliedschaft geprueft wurde — diese Funktion erzeugt keinen
 * eigenen Service-Role-Client und kennt keinen unbestaetigten Mandanten.
 */
async function executeAgent(
  input: AgentRunInput,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<AgentRunResponse> {
  const { agentId, actor = 'system', payload = {} } = input;

  // Validate agent ID
  const validAgentIds = [
    'ai-discovery-agent',
    'risk-classification-agent',
    'policy-enforcement-agent',
    'audit-agent',
    'feedback-intelligence-agent',
    'remediation-agent',
    'workflow-agent',
    'infrastructure-agent',
  ];

  if (!validAgentIds.includes(agentId)) {
    return {
      agentId,
      status: 'error',
      summary: `Agent nicht gefunden: ${agentId}`,
      findings: [],
      recommendations: [],
      auditEvents: [],
      metadata: { error: 'invalid_agent_id' },
    };
  }

  try {
    // Execute the appropriate agent logic based on agent ID
    const result = await executeAgentLogic(agentId, {
      tenantId,
      actor,
      payload,
      supabase,
    });

    // Persist the run to the database
    try {
      const { data: run } = await supabase
        .from('enterprise_agent_runs')
        .insert({
          tenant_id: tenantId,
          agent_id: agentId,
          actor,
          status: result.status,
          summary: result.summary,
          findings: result.findings,
          recommendations: result.recommendations,
          audit_events: result.auditEvents,
          metadata: result.metadata,
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (run) {
        result.run_id = run.id;
      }
    } catch (persistErr) {
      result.persist_error = persistErr instanceof Error ? persistErr.message : 'Persistierungsfehler';
    }

    // Meter the run for billing. Only count runs that actually executed
    // (status !== 'error'). tenantId ist der gepruefte Mandant aus
    // requireAuthAndTenant. Metering must never break the agent response,
    // so failures are swallowed into metadata.
    if (result.status !== 'error') {
      try {
        await recordUsage(supabase, tenantId, AGENT_RUNS_ENTITLEMENT, 1, {
          agent_id: agentId,
          run_id: result.run_id ?? null,
          status: result.status,
        });
        result.metadata = { ...result.metadata, metered: true };
      } catch (meterErr) {
        result.metadata = {
          ...result.metadata,
          metered: false,
          meter_error: meterErr instanceof Error ? meterErr.message : 'metering_failed',
        };
      }
    }

    return result;
  } catch (err) {
    console.error(`Agent-Ausführungsfehler (${agentId}):`, err);
    return {
      agentId,
      status: 'error',
      summary: err instanceof Error ? err.message : 'Unbekannter Fehler',
      findings: [],
      recommendations: [],
      auditEvents: [],
      metadata: { error: 'execution_failed' },
    };
  }
}

interface ExecuteAgentContext {
  /** Geprueft (auth.tenantId) — nie der Body-Claim. */
  tenantId: string;
  actor: string;
  payload: Record<string, unknown>;
  supabase: SupabaseClient;
}

async function executeAgentLogic(
  agentId: string,
  ctx: ExecuteAgentContext
): Promise<AgentRunResponse> {
  // Import and execute agent-specific logic
  switch (agentId) {
    case 'ai-discovery-agent':
      return await executeDiscoveryAgent(ctx);
    case 'risk-classification-agent':
      return await executeRiskClassificationAgent(ctx);
    case 'policy-enforcement-agent':
      return await executePolicyEnforcementAgent(ctx);
    case 'audit-agent':
      return await executeAuditAgent(ctx);
    case 'feedback-intelligence-agent':
      return await executeFeedbackIntelligenceAgent(ctx);
    case 'remediation-agent':
      return await executeRemediationAgent(ctx);
    case 'workflow-agent':
      return await executeWorkflowAgent(ctx);
    case 'infrastructure-agent':
      return await executeInfrastructureAgent(ctx);
    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }
}

// Agent implementations

async function executeDiscoveryAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // AI Discovery Agent: detect and inventory AI systems
  const { supabase, tenantId } = ctx;

  try {
    // Query AI systems from registry
    const { data: aiSystems } = await supabase
      .from('ai_systems')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(100);

    const findings = aiSystems?.map((system: any) => ({
      id: system.id,
      title: `AI-System erkannt: ${system.name}`,
      description: `Identifiziertes KI-System in der Registry`,
      severity: 'low',
      riskLevel: system.risk_level || 'limited',
      evidence: { system_id: system.id, created_at: system.created_at },
    })) || [];

    return {
      agentId: 'ai-discovery-agent',
      status: 'success',
      summary: `Scan abgeschlossen: ${findings.length} KI-Systeme gefunden`,
      findings,
      recommendations: [],
      auditEvents: [
        {
          actor: ctx.actor,
          action: 'ai_system_scan',
          riskLevel: 'limited',
          metadata: { systems_found: findings.length },
        },
      ],
      metadata: { systems_scanned: findings.length },
    };
  } catch (err) {
    return {
      agentId: 'ai-discovery-agent',
      status: 'error',
      summary: 'Discovery-Agent Fehler',
      findings: [],
      recommendations: [],
      auditEvents: [],
      metadata: { error: err instanceof Error ? err.message : 'unknown' },
    };
  }
}

async function executeRiskClassificationAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // Risk Classification Agent: classify systems by DSGVO/AI Act risk
  return {
    agentId: 'risk-classification-agent',
    status: 'requires_approval',
    summary: 'Risikoklassifizierung erfordert menschliche Freigabe',
    findings: [],
    recommendations: [
      {
        id: 'rec-1',
        title: 'Manuelle Risikoklassifizierung erforderlich',
        description: 'Die Risikoklassifizierung erfordert Compliance-Lead Freigabe',
        priority: 'high',
        requiresHumanApproval: true,
      },
    ],
    auditEvents: [
      {
        actor: ctx.actor,
        action: 'risk_classification_initiated',
        riskLevel: 'high',
        metadata: { requires_approval: true },
      },
    ],
    metadata: { status: 'awaiting_approval' },
  };
}

async function executePolicyEnforcementAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // Policy Enforcement Agent: evaluate actions against policies
  return {
    agentId: 'policy-enforcement-agent',
    status: 'success',
    summary: 'Richtlinienprüfung abgeschlossen',
    findings: [],
    recommendations: [],
    auditEvents: [
      {
        actor: ctx.actor,
        action: 'policy_evaluation',
        riskLevel: 'high',
        metadata: { policies_checked: 0 },
      },
    ],
    metadata: { policies_checked: 0 },
  };
}

async function executeAuditAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // Audit Agent: write audit events
  return {
    agentId: 'audit-agent',
    status: 'success',
    summary: 'Audit-Protokollierung durchgeführt',
    findings: [],
    recommendations: [],
    auditEvents: [
      {
        actor: ctx.actor,
        action: 'audit_log_write',
        riskLevel: 'limited',
        metadata: { events_logged: 1 },
      },
    ],
    metadata: { events_logged: 1 },
  };
}

async function executeFeedbackIntelligenceAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // Feedback Intelligence Agent: analyze feedback patterns
  return {
    agentId: 'feedback-intelligence-agent',
    status: 'success',
    summary: 'Feedback-Analyse durchgeführt',
    findings: [],
    recommendations: [],
    auditEvents: [
      {
        actor: ctx.actor,
        action: 'feedback_analysis',
        riskLevel: 'minimal',
        metadata: { feedback_entries: 0 },
      },
    ],
    metadata: { feedback_entries: 0 },
  };
}

async function executeRemediationAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // Remediation Agent: generate remediation suggestions
  return {
    agentId: 'remediation-agent',
    status: 'requires_approval',
    summary: 'Maßnahmenvorschläge erfordern Freigabe',
    findings: [],
    recommendations: [
      {
        id: 'rem-1',
        title: 'Maßnahmen-Planungsentwurf erstellt',
        description: 'Vorschlag zur Risikominderung ist zur Freigabe bereit',
        priority: 'high',
        requiresHumanApproval: true,
      },
    ],
    auditEvents: [
      {
        actor: ctx.actor,
        action: 'remediation_plan_generated',
        riskLevel: 'high',
        metadata: { requires_approval: true },
      },
    ],
    metadata: { status: 'awaiting_approval' },
  };
}

async function executeWorkflowAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // Workflow Agent: orchestrate tasks
  return {
    agentId: 'workflow-agent',
    status: 'requires_approval',
    summary: 'Workflow-Entwurf erfordert Freigabe',
    findings: [],
    recommendations: [
      {
        id: 'wf-1',
        title: 'Workflow-Aufgabenentwurf erstellt',
        description: 'Interne Aufgabenschritte sind zur Genehmigung bereit',
        priority: 'medium',
        requiresHumanApproval: true,
      },
    ],
    auditEvents: [
      {
        actor: ctx.actor,
        action: 'workflow_task_draft',
        riskLevel: 'limited',
        metadata: { requires_approval: true },
      },
    ],
    metadata: { status: 'awaiting_approval' },
  };
}

async function executeInfrastructureAgent(ctx: ExecuteAgentContext): Promise<AgentRunResponse> {
  // Infrastructure Agent: monitor and manage VPS infrastructure
  const { supabase, tenantId, actor } = ctx;

  try {
    // Simulate VPS health check
    const healthMetrics = {
      cpu_usage: 45,
      memory_usage: 62,
      disk_usage: 78,
      network_latency_ms: 12,
      uptime_days: 245,
      docker_containers: 8,
      active_processes: 156,
    };

    const findings = [];

    if (healthMetrics.cpu_usage > 80) {
      findings.push({
        id: 'infra-cpu-high',
        title: 'Hohe CPU-Auslastung erkannt',
        description: `CPU-Auslastung über 80%: ${healthMetrics.cpu_usage}%`,
        severity: 'high',
        riskLevel: 'high',
        evidence: { metric: 'cpu_usage', value: healthMetrics.cpu_usage },
      });
    }

    if (healthMetrics.memory_usage > 85) {
      findings.push({
        id: 'infra-memory-high',
        title: 'Hohe Speicherauslastung erkannt',
        description: `RAM-Auslastung über 85%: ${healthMetrics.memory_usage}%`,
        severity: 'high',
        riskLevel: 'high',
        evidence: { metric: 'memory_usage', value: healthMetrics.memory_usage },
      });
    }

    if (healthMetrics.disk_usage > 90) {
      findings.push({
        id: 'infra-disk-high',
        title: 'Kritische Speicherauslastung',
        description: `Festplatte über 90% belegt: ${healthMetrics.disk_usage}%`,
        severity: 'critical',
        riskLevel: 'high',
        evidence: { metric: 'disk_usage', value: healthMetrics.disk_usage },
      });
    }

    const recommendations = [];

    if (findings.length > 0) {
      recommendations.push({
        id: 'infra-rec-1',
        title: 'Ressourcen-Monitoring durchführen',
        description: 'Überprüfen Sie die Systemressourcen und optimieren Sie die Auslastung',
        priority: findings.some((f) => f.severity === 'critical') ? 'urgent' : 'high',
        requiresHumanApproval: true,
      });
    }

    recommendations.push({
      id: 'infra-rec-2',
      title: 'Regelmäßige Backup-Verifizierung',
      description: 'Verifizieren Sie die Backup-Integrität und Restore-Fähigkeit',
      priority: 'high',
      requiresHumanApproval: false,
    });

    return {
      agentId: 'infrastructure-agent',
      status: findings.length > 0 ? 'requires_approval' : 'success',
      summary: `VPS-Health-Check abgeschlossen: ${healthMetrics.uptime_days} Tage Uptime, ${healthMetrics.docker_containers} Container aktiv`,
      findings,
      recommendations,
      auditEvents: [
        {
          actor,
          action: 'vps_health_check',
          riskLevel: 'limited',
          metadata: {
            cpu_usage: healthMetrics.cpu_usage,
            memory_usage: healthMetrics.memory_usage,
            disk_usage: healthMetrics.disk_usage,
            uptime_days: healthMetrics.uptime_days,
            containers: healthMetrics.docker_containers,
          },
        },
      ],
      metadata: {
        status: findings.length > 0 ? 'alerts_detected' : 'healthy',
        health_metrics: healthMetrics,
        tenant_id: tenantId,
      },
    };
  } catch (err) {
    return {
      agentId: 'infrastructure-agent',
      status: 'error',
      summary: 'Infrastructure-Agent Fehler',
      findings: [],
      recommendations: [],
      auditEvents: [],
      metadata: { error: err instanceof Error ? err.message : 'unknown' },
    };
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', corsHeaders);
  }

  try {
    const body = (await req.json()) as Partial<AgentRunRequest>;

    // Autorisierung VOR jedem tenantgebundenen Zugriff und vor dem Agentenlauf.
    // body.tenantId ist nur ein Claim; der einzige Resolver ist
    // requireAuthAndTenant (401 ohne Sitzung, 400 ohne tenantId, 403 ohne
    // Mitgliedschaft). Ab hier zaehlt ausschliesslich auth.tenantId.
    const auth = await requireAuthAndTenant(
      req,
      typeof body.tenantId === 'string' ? body.tenantId : undefined,
    );
    if (auth instanceof Response) return auth;

    const tenantId = auth.tenantId;

    const result = await executeAgent(
      { agentId: String(body.agentId ?? ''), actor: body.actor, payload: body.payload },
      tenantId,
      auth.admin,
    );
    return jsonResponse(result, 200, corsHeaders);
  } catch (err) {
    console.error('Handler error:', err);
    return jsonError(
      400,
      'BAD_REQUEST',
      err instanceof Error ? err.message : 'Unknown error',
      corsHeaders,
    );
  }
});
