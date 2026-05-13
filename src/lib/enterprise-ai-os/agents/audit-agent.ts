import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import type { AiRiskLevel } from '../types';
import { getEnterpriseAgent } from './registry';

export class AuditAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('audit-agent');
    if (!definition) throw new Error('Audit Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const event = {
      actor: String(input.payload.actor || input.actor || 'audit-agent'),
      action: String(input.payload.action || 'audit_event_recorded'),
      systemName: String(input.payload.systemName || 'unknown'),
      riskLevel: ((input.payload.riskLevel as AiRiskLevel) || 'unknown') as AiRiskLevel,
      metadata: {
        ...(input.payload.metadata as Record<string, unknown> | undefined),
        tenantId: input.tenantId,
        recordedAt: new Date().toISOString(),
      },
    };

    return this.success(input, {
      summary: 'Audit event prepared.',
      findings: [],
      recommendations: [],
      auditEvents: [event],
      metadata: { event },
    });
  }
}
