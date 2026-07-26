import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import type { AiRiskLevel } from '../types';
import { getEnterpriseAgent } from './registry';

interface AuditableAction {
  action: string;
  actor: string;
  systemName: string;
  riskLevel: AiRiskLevel;
  metadata: Record<string, unknown>;
}

export class AuditAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('audit-agent');
    if (!definition) throw new Error('Audit Agent definition missing');
    super(definition);
  }

  private categorizeAction(action: string): 'system_change' | 'access' | 'execution' | 'decision' | 'other' {
    const lower = action.toLowerCase();
    if (lower.includes('create') || lower.includes('update') || lower.includes('delete') || lower.includes('modify'))
      return 'system_change';
    if (lower.includes('access') || lower.includes('login') || lower.includes('read')) return 'access';
    if (lower.includes('execute') || lower.includes('run') || lower.includes('deploy')) return 'execution';
    if (lower.includes('classify') || lower.includes('decide') || lower.includes('approve')) return 'decision';
    return 'other';
  }

  private determineComplianceScope(riskLevel: AiRiskLevel): string[] {
    const scopes = [];
    if (riskLevel === 'prohibited' || riskLevel === 'high') {
      scopes.push('DSGVO Accountability', 'EU AI Act Documentation', 'Art. 6 Lawfulness');
    } else {
      scopes.push('General Audit Trail', 'System Integrity');
    }
    return scopes;
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const actor = String(input.payload.actor || input.actor || 'audit-agent');
    const action = String(input.payload.action || 'audit_event_recorded');
    const systemName = String(input.payload.systemName || 'unknown');
    const riskLevel = ((input.payload.riskLevel as AiRiskLevel) || 'unknown') as AiRiskLevel;
    const timestamp = new Date().toISOString();

    const actionCategory = this.categorizeAction(action);
    const complianceScope = this.determineComplianceScope(riskLevel);

    const event = {
      actor,
      action,
      systemName,
      riskLevel,
      metadata: {
        ...(input.payload.metadata as Record<string, unknown> | undefined),
        tenantId: input.tenantId,
        recordedAt: timestamp,
        actionCategory,
        complianceScope,
      },
    };

    const findings: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      riskLevel: AiRiskLevel;
      evidence: Record<string, unknown>;
    }> = riskLevel === 'high' || riskLevel === 'prohibited' ? [
      {
        id: 'audit-high-risk-action',
        title: `Audit trail: High-risk action logged`,
        description: `Action "${action}" by ${actor} on system "${systemName}" at ${timestamp}. Risk level: ${riskLevel}. Requires compliance review.`,
        severity: riskLevel === 'prohibited' ? 'critical' : 'high',
        riskLevel,
        evidence: {
          action,
          actor,
          systemName,
          actionCategory,
          timestamp,
        },
      },
    ] : [];

    const recommendations = riskLevel === 'prohibited' ? [
      {
        id: 'audit-critical-action',
        title: 'Critical action audit: Compliance sign-off required',
        description: `This prohibited-risk action requires immediate review by compliance officer. Evidence must be preserved in immutable audit log.`,
        priority: 'urgent' as const,
        requiresHumanApproval: true,
      },
    ] : [];

    return this.success(input, {
      summary: `Audit event logged: ${action} by ${actor} on ${systemName}${riskLevel !== 'unknown' ? ` (risk: ${riskLevel})` : ''}.`,
      findings,
      recommendations,
      auditEvents: [event],
      metadata: {
        event,
        actionCategory,
        complianceScope,
        timestamp,
        auditTraceId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
    });
  }
}
