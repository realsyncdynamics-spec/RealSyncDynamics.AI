import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import type { AiRiskLevel } from '../types';
import { getEnterpriseAgent } from './registry';

export class RiskClassificationAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('risk-classification-agent');
    if (!definition) throw new Error('Risk Classification Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const dataCategories = Array.isArray(input.payload.dataCategories)
      ? (input.payload.dataCategories as unknown[]).map(String)
      : [];

    const usageContext = String(input.payload.usageContext || '').toLowerCase();

    let riskLevel: AiRiskLevel = 'limited';

    if (
      dataCategories.includes('health_data') ||
      dataCategories.includes('biometric_data') ||
      dataCategories.includes('payroll_data') ||
      usageContext.includes('employment') ||
      usageContext.includes('credit') ||
      usageContext.includes('law enforcement')
    ) {
      riskLevel = 'high';
    }

    if (
      usageContext.includes('social scoring') ||
      usageContext.includes('manipulation')
    ) {
      riskLevel = 'prohibited';
    }

    const requiresApproval = riskLevel === 'high' || riskLevel === 'prohibited';

    return this.requiresApproval(input, {
      summary: `System classified as ${riskLevel}.`,
      findings: [
        {
          id: 'risk-classification',
          title: 'AI risk classification completed',
          description: `The submitted AI system was classified as ${riskLevel}.`,
          severity:
            riskLevel === 'prohibited'
              ? 'critical'
              : riskLevel === 'high'
                ? 'high'
                : 'medium',
          riskLevel,
          evidence: { dataCategories, usageContext },
        },
      ],
      recommendations: [
        {
          id: 'human-review',
          title: 'Human governance review required',
          description: requiresApproval
            ? 'A human review is required before approval or external use.'
            : 'Document usage context and continue monitoring.',
          priority: requiresApproval ? 'high' : 'medium',
          requiresHumanApproval: requiresApproval,
        },
      ],
      auditEvents: [
        {
          actor: input.actor || 'risk-classification-agent',
          action: 'risk_classified',
          systemName: String(input.payload.systemName || 'unknown'),
          riskLevel,
          metadata: { dataCategories, usageContext, tenantId: input.tenantId },
        },
      ],
      metadata: { riskLevel, requiresApproval },
    });
  }
}
