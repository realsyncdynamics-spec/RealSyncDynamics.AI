// Mirror of src/lib/enterprise-ai-os/agents/ for use from Deno Edge Functions.
//
// Pure logic, no DB writes. The Vite frontend imports the registry +
// agent classes directly from src/lib; this file exists so the Edge
// Functions can serve the same registry + dispatcher to external API
// consumers without bundling Vite-internal modules.
//
// If the source-of-truth registry in src/lib/enterprise-ai-os/agents/
// changes, mirror the change here.

type AiRiskLevel = 'minimal' | 'limited' | 'high' | 'prohibited' | 'unknown';

export type AgentId =
  | 'ai-discovery-agent'
  | 'risk-classification-agent'
  | 'policy-enforcement-agent'
  | 'audit-agent'
  | 'feedback-intelligence-agent'
  | 'remediation-agent'
  | 'workflow-agent';

export interface AgentRunInput {
  agentId: AgentId;
  tenantId?: string;
  actor?: string;
  payload: Record<string, unknown>;
}

export interface AgentRunResult {
  agentId: AgentId;
  status: 'success' | 'blocked' | 'requires_approval' | 'error';
  summary: string;
  findings: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Static registry (mirror of src/lib/enterprise-ai-os/agents/registry.ts).
// ---------------------------------------------------------------------------
export const enterpriseAgents = [
  {
    id: 'ai-discovery-agent',
    name: 'AI Discovery Agent',
    shortName: 'Discovery',
    layer: 'discovery',
    order: 1,
    autonomyLevel: 'observe_only',
    status: 'active',
    auditRequired: true,
    humanApprovalRequired: false,
  },
  {
    id: 'risk-classification-agent',
    name: 'Risk Classification Agent',
    shortName: 'Risk',
    layer: 'governance',
    order: 2,
    autonomyLevel: 'recommend_only',
    status: 'active',
    auditRequired: true,
    humanApprovalRequired: true,
  },
  {
    id: 'policy-enforcement-agent',
    name: 'Policy Enforcement Agent',
    shortName: 'Policy',
    layer: 'policy',
    order: 3,
    autonomyLevel: 'human_approval_required',
    status: 'active',
    auditRequired: true,
    humanApprovalRequired: false,
  },
  {
    id: 'audit-agent',
    name: 'Audit Agent',
    shortName: 'Audit',
    layer: 'audit',
    order: 4,
    autonomyLevel: 'limited_execution',
    status: 'active',
    auditRequired: false,
    humanApprovalRequired: false,
  },
  {
    id: 'feedback-intelligence-agent',
    name: 'Feedback Intelligence Agent',
    shortName: 'Feedback',
    layer: 'intelligence',
    order: 5,
    autonomyLevel: 'recommend_only',
    status: 'experimental',
    auditRequired: true,
    humanApprovalRequired: true,
  },
  {
    id: 'remediation-agent',
    name: 'Remediation Agent',
    shortName: 'Remediation',
    layer: 'remediation',
    order: 6,
    autonomyLevel: 'recommend_only',
    status: 'active',
    auditRequired: true,
    humanApprovalRequired: true,
  },
  {
    id: 'workflow-agent',
    name: 'Workflow Agent',
    shortName: 'Workflow',
    layer: 'orchestration',
    order: 7,
    autonomyLevel: 'human_approval_required',
    status: 'experimental',
    auditRequired: true,
    humanApprovalRequired: true,
  },
];

// ---------------------------------------------------------------------------
// Dispatcher — mirror of agent run() bodies.
// ---------------------------------------------------------------------------
const KNOWN_AI_SIGNALS = [
  'openai', 'chatgpt', 'claude', 'anthropic', 'gemini', 'copilot',
  'mistral', 'perplexity', 'huggingface',
];

function runDiscovery(input: AgentRunInput): AgentRunResult {
  const sources = Array.isArray(input.payload.sources)
    ? (input.payload.sources as unknown[]).map(String) : [];
  const detected = sources.filter((s) =>
    KNOWN_AI_SIGNALS.some((sig) => s.toLowerCase().includes(sig)));
  return {
    agentId: 'ai-discovery-agent',
    status: 'success',
    summary: `${detected.length} potential AI systems detected.`,
    findings: detected.map((s, i) => ({
      id: `ai-signal-${i}`, title: 'Potential AI system detected',
      description: `Detected AI-related signal: ${s}`,
      severity: 'medium', riskLevel: 'limited', evidence: { source: s },
    })),
    recommendations: detected.map((s, i) => ({
      id: `review-ai-${i}`, title: 'Review AI system',
      description: `Review whether ${s} is approved, documented and policy-compliant.`,
      priority: 'medium', requiresHumanApproval: true,
    })),
    auditEvents: detected.map((s) => ({
      actor: input.actor || 'ai-discovery-agent', action: 'ai_system_detected',
      systemName: s, riskLevel: 'limited',
      metadata: { source: s, tenantId: input.tenantId },
    })),
    metadata: { detected },
  };
}

function runRiskClassification(input: AgentRunInput): AgentRunResult {
  const dataCategories = Array.isArray(input.payload.dataCategories)
    ? (input.payload.dataCategories as unknown[]).map(String) : [];
  const usageContext = String(input.payload.usageContext || '').toLowerCase();
  let riskLevel: AiRiskLevel = 'limited';
  if (
    dataCategories.includes('health_data') ||
    dataCategories.includes('biometric_data') ||
    dataCategories.includes('payroll_data') ||
    usageContext.includes('employment') ||
    usageContext.includes('credit') ||
    usageContext.includes('law enforcement')
  ) riskLevel = 'high';
  if (usageContext.includes('social scoring') || usageContext.includes('manipulation'))
    riskLevel = 'prohibited';
  const requiresApproval = riskLevel === 'high' || riskLevel === 'prohibited';
  return {
    agentId: 'risk-classification-agent', status: 'requires_approval',
    summary: `System classified as ${riskLevel}.`,
    findings: [{
      id: 'risk-classification', title: 'AI risk classification completed',
      description: `The submitted AI system was classified as ${riskLevel}.`,
      severity: riskLevel === 'prohibited' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium',
      riskLevel, evidence: { dataCategories, usageContext },
    }],
    recommendations: [{
      id: 'human-review', title: 'Human governance review required',
      description: requiresApproval
        ? 'A human review is required before approval or external use.'
        : 'Document usage context and continue monitoring.',
      priority: requiresApproval ? 'high' : 'medium', requiresHumanApproval: requiresApproval,
    }],
    auditEvents: [{
      actor: input.actor || 'risk-classification-agent', action: 'risk_classified',
      systemName: String(input.payload.systemName || 'unknown'), riskLevel,
      metadata: { dataCategories, usageContext, tenantId: input.tenantId },
    }],
    metadata: { riskLevel, requiresApproval },
  };
}

function runAudit(input: AgentRunInput): AgentRunResult {
  const event = {
    actor: String(input.payload.actor || input.actor || 'audit-agent'),
    action: String(input.payload.action || 'audit_event_recorded'),
    systemName: String(input.payload.systemName || 'unknown'),
    riskLevel: (input.payload.riskLevel as AiRiskLevel) || 'unknown',
    metadata: {
      ...(input.payload.metadata as Record<string, unknown> | undefined),
      tenantId: input.tenantId, recordedAt: new Date().toISOString(),
    },
  };
  return {
    agentId: 'audit-agent', status: 'success', summary: 'Audit event prepared.',
    findings: [], recommendations: [], auditEvents: [event], metadata: { event },
  };
}

function runFeedback(input: AgentRunInput): AgentRunResult {
  const reports = (Array.isArray(input.payload.reports)
    ? input.payload.reports : []) as Array<{ type?: string; severity?: string }>;
  const criticalCount = reports.filter((r) => r.severity === 'critical').length;
  const bugCount = reports.filter((r) => r.type === 'bug').length;
  const featureCount = reports.filter((r) => r.type === 'feature_request').length;
  return {
    agentId: 'feedback-intelligence-agent', status: 'requires_approval',
    summary: `Analyzed ${reports.length} feedback reports.`,
    findings: [{
      id: 'feedback-summary', title: 'Feedback cluster summary',
      description: `${bugCount} bugs, ${featureCount} feature requests, ${criticalCount} critical reports.`,
      severity: criticalCount > 0 ? 'critical' : 'medium',
      riskLevel: criticalCount > 0 ? 'high' : 'limited',
      evidence: { bugCount, featureCount, criticalCount },
    }],
    recommendations: [{
      id: 'roadmap-review', title: 'Review feedback for roadmap',
      description: 'Clustered feedback should be reviewed by product owner before roadmap changes.',
      priority: criticalCount > 0 ? 'urgent' : 'medium', requiresHumanApproval: true,
    }],
    auditEvents: [{
      actor: input.actor || 'feedback-intelligence-agent', action: 'feedback_analyzed',
      riskLevel: criticalCount > 0 ? 'high' : 'limited',
      metadata: { bugCount, featureCount, criticalCount, tenantId: input.tenantId },
    }],
    metadata: { bugCount, featureCount, criticalCount },
  };
}

function runRemediation(input: AgentRunInput): AgentRunResult {
  const riskLevel = (input.payload.riskLevel as AiRiskLevel) || 'unknown';
  const issue = String(input.payload.issue || 'Unspecified governance issue');
  const priority = riskLevel === 'prohibited' ? 'urgent'
    : riskLevel === 'high' ? 'high' : 'medium';
  return {
    agentId: 'remediation-agent', status: 'requires_approval',
    summary: 'Remediation plan drafted. Human approval required.',
    findings: [{
      id: 'remediation-target', title: 'Remediation target identified',
      description: issue,
      severity: riskLevel === 'prohibited' ? 'critical' : 'high',
      riskLevel, evidence: input.payload,
    }],
    recommendations: [
      { id: 'remediation-step-1', title: 'Freeze external usage',
        description: 'Pause external or customer-facing use until risk review is completed.',
        priority, requiresHumanApproval: true },
      { id: 'remediation-step-2', title: 'Document processing context',
        description: 'Document system purpose, data categories, model provider and approval owner.',
        priority: 'high', requiresHumanApproval: true },
      { id: 'remediation-step-3', title: 'Apply policy controls',
        description: 'Attach an agent policy that restricts sensitive data and external actions.',
        priority: 'high', requiresHumanApproval: true },
    ],
    auditEvents: [{
      actor: input.actor || 'remediation-agent', action: 'remediation_plan_created',
      systemName: String(input.payload.systemName || 'unknown'),
      riskLevel, metadata: { issue, tenantId: input.tenantId },
    }],
    metadata: { priority, issue },
  };
}

function runWorkflow(input: AgentRunInput): AgentRunResult {
  const steps = Array.isArray(input.payload.steps)
    ? (input.payload.steps as unknown[]).map(String) : [];
  return {
    agentId: 'workflow-agent', status: 'requires_approval',
    summary: `${steps.length} workflow task drafts created. Approval required before execution.`,
    findings: [],
    recommendations: steps.map((s, i) => ({
      id: `workflow-step-${i}`, title: `Task draft ${i + 1}`,
      description: s, priority: 'medium', requiresHumanApproval: true,
    })),
    auditEvents: [{
      actor: input.actor || 'workflow-agent', action: 'workflow_task_drafts_created',
      riskLevel: 'limited', metadata: { steps, tenantId: input.tenantId },
    }],
    metadata: { steps },
  };
}

// Note: policy-enforcement-agent has the same input/output as the existing
// /functions/v1/enterprise-ai-os-evaluate endpoint. Rather than duplicating
// policy-engine logic, callers should hit that endpoint and forward results.
// For symmetry, we expose a thin agent wrapper that returns 'requires_approval'.
function runPolicyEnforcement(input: AgentRunInput): AgentRunResult {
  return {
    agentId: 'policy-enforcement-agent', status: 'requires_approval',
    summary:
      'Policy evaluation must be performed via /functions/v1/enterprise-ai-os-evaluate. ' +
      'Approval required before applying.',
    findings: [], recommendations: [], auditEvents: [],
    metadata: { delegateTo: 'enterprise-ai-os-evaluate' },
  };
}

export function runEnterpriseAgent(input: AgentRunInput): AgentRunResult {
  switch (input.agentId) {
    case 'ai-discovery-agent': return runDiscovery(input);
    case 'risk-classification-agent': return runRiskClassification(input);
    case 'policy-enforcement-agent': return runPolicyEnforcement(input);
    case 'audit-agent': return runAudit(input);
    case 'feedback-intelligence-agent': return runFeedback(input);
    case 'remediation-agent': return runRemediation(input);
    case 'workflow-agent': return runWorkflow(input);
    default:
      return {
        agentId: input.agentId, status: 'error',
        summary: `Unknown agent: ${input.agentId}`,
        findings: [], recommendations: [], auditEvents: [],
        metadata: { error: true },
      };
  }
}
