import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

export class WorkflowAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('workflow-agent');
    if (!definition) throw new Error('Workflow Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const steps = Array.isArray(input.payload.steps)
      ? (input.payload.steps as unknown[]).map(String)
      : [];

    return this.requiresApproval(input, {
      summary: `${steps.length} workflow task drafts created. Approval required before execution.`,
      findings: [],
      recommendations: steps.map((step, index) => ({
        id: `workflow-step-${index}`,
        title: `Task draft ${index + 1}`,
        description: step,
        priority: 'medium' as const,
        requiresHumanApproval: true,
      })),
      auditEvents: [
        {
          actor: input.actor || 'workflow-agent',
          action: 'workflow_task_drafts_created',
          riskLevel: 'limited',
          metadata: { steps, tenantId: input.tenantId },
        },
      ],
      metadata: { steps },
    });
  }
}
