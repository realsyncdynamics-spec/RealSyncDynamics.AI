import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import type { AiRiskLevel } from '../types';
import { getEnterpriseAgent } from './registry';

export class RemediationAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('remediation-agent');
    if (!definition) throw new Error('Remediation Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const riskLevel = ((input.payload.riskLevel as AiRiskLevel) || 'unknown') as AiRiskLevel;
    const issue = String(input.payload.issue || 'Unspecified governance issue');

    const priority: 'urgent' | 'high' | 'medium' =
      riskLevel === 'prohibited' ? 'urgent' : riskLevel === 'high' ? 'high' : 'medium';

    return this.requiresApproval(input, {
      summary: 'Remediation plan drafted. Human approval required.',
      findings: [
        {
          id: 'remediation-target',
          title: 'Remediation target identified',
          description: issue,
          severity: riskLevel === 'prohibited' ? 'critical' : 'high',
          riskLevel,
          evidence: input.payload,
        },
      ],
      recommendations: [
        {
          id: 'remediation-step-1',
          title: 'Freeze external usage',
          description: 'Pause external or customer-facing use until risk review is completed.',
          priority,
          requiresHumanApproval: true,
        },
        {
          id: 'remediation-step-2',
          title: 'Document processing context',
          description:
            'Document system purpose, data categories, model provider and approval owner.',
          priority: 'high',
          requiresHumanApproval: true,
        },
        {
          id: 'remediation-step-3',
          title: 'Apply policy controls',
          description:
            'Attach an agent policy that restricts sensitive data and external actions.',
          priority: 'high',
          requiresHumanApproval: true,
        },
      ],
      auditEvents: [
        {
          actor: input.actor || 'remediation-agent',
          action: 'remediation_plan_created',
          systemName: String(input.payload.systemName || 'unknown'),
          riskLevel,
          metadata: { issue, tenantId: input.tenantId },
        },
      ],
      metadata: { priority, issue },
    });
  }
}
