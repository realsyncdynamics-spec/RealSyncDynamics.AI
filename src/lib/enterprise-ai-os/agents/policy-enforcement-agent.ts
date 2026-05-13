import { evaluateAgentAction } from '../policy-engine';
import type { AgentPolicy } from '../types';
import type { AiRiskLevel } from '../types';
import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult, AgentFinding } from './types';
import { getEnterpriseAgent } from './registry';

type PolicyInput = Pick<
  AgentPolicy,
  'allowed_models' | 'forbidden_data_categories' | 'requires_human_approval' | 'external_actions_allowed'
>;

export class PolicyEnforcementAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('policy-enforcement-agent');
    if (!definition) throw new Error('Policy Enforcement Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const riskLevel = (input.payload.riskLevel as AiRiskLevel) || 'unknown';
    const policy: PolicyInput =
      (input.payload.policy as PolicyInput | undefined) ?? {
        allowed_models: [],
        forbidden_data_categories: [],
        requires_human_approval: true,
        external_actions_allowed: false,
      };

    const result = evaluateAgentAction({
      model: String(input.payload.model || 'unknown'),
      dataCategories: Array.isArray(input.payload.dataCategories)
        ? (input.payload.dataCategories as unknown[]).map(String)
        : [],
      externalAction: Boolean(input.payload.externalAction),
      riskLevel,
      policy,
    });

    const findings: AgentFinding[] = result.reasons.map((reason, index) => ({
      id: `policy-finding-${index}`,
      title: result.allowed ? 'Policy condition' : 'Policy violation',
      description: reason,
      severity: result.allowed ? 'low' : 'high',
      riskLevel,
      evidence: { reason },
    }));

    const base = {
      summary: result.allowed
        ? 'Agent action allowed by policy.'
        : 'Agent action blocked by policy.',
      findings,
      recommendations: [
        {
          id: 'policy-review',
          title: result.requiresApproval ? 'Human approval required' : 'No approval required',
          description: result.requiresApproval
            ? 'Route this action to an authorized reviewer.'
            : 'Action can proceed within the current policy boundary.',
          priority: result.requiresApproval ? ('high' as const) : ('low' as const),
          requiresHumanApproval: result.requiresApproval,
        },
      ],
      auditEvents: [
        {
          actor: input.actor || 'policy-enforcement-agent',
          action: result.allowed ? 'policy_allowed' : 'policy_blocked',
          systemName: String(input.payload.systemName || 'unknown'),
          riskLevel,
          metadata: { ...result, tenantId: input.tenantId },
        },
      ],
      metadata: result as unknown as Record<string, unknown>,
    };

    if (!result.allowed) return this.blocked(input, base);
    if (result.requiresApproval) return this.requiresApproval(input, base);
    return this.success(input, base);
  }
}
