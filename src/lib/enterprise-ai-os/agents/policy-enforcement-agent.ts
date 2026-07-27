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

  private categorizeViolation(reason: string): 'data_protection' | 'model_restriction' | 'external_action' | 'risk_threshold' | 'other' {
    const lower = reason.toLowerCase();
    if (lower.includes('data') || lower.includes('category')) return 'data_protection';
    if (lower.includes('model')) return 'model_restriction';
    if (lower.includes('external')) return 'external_action';
    if (lower.includes('risk')) return 'risk_threshold';
    return 'other';
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const riskLevel = (input.payload.riskLevel as AiRiskLevel) || 'unknown';
    const systemName = String(input.payload.systemName || 'unknown');
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

    const violationCategories = new Set(result.reasons.map((r) => this.categorizeViolation(r)));

    const findings: AgentFinding[] = result.reasons.map((reason, index) => {
      const violationType = this.categorizeViolation(reason);
      return {
        id: `policy-finding-${violationType}-${index}`,
        title: result.allowed ? `Policy check: ${violationType}` : `Policy violation: ${violationType}`,
        description: reason,
        severity: result.allowed ? 'low' : 'high',
        riskLevel: result.allowed ? 'limited' : riskLevel,
        evidence: {
          reason,
          violationType,
          policy: { allowed_models: policy.allowed_models?.slice(0, 3), external_actions_allowed: policy.external_actions_allowed },
        },
      };
    });

    const recommendations: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      requiresHumanApproval: boolean;
    }> = [
      {
        id: 'policy-enforcement',
        title: result.allowed ? 'Action aligns with policy' : 'Policy enforcement required',
        description: result.allowed
          ? `${systemName} action passes policy validation. ${result.requiresApproval ? 'Human review still recommended.' : 'Proceed with execution.'}`
          : `Action blocked due to ${Array.from(violationCategories).join(', ')}. Route to policy owner for review or exception request.`,
        priority: result.allowed ? 'low' : result.requiresApproval ? 'urgent' : 'high',
        requiresHumanApproval: result.requiresApproval || !result.allowed,
      },
    ];

    if (violationCategories.has('external_action')) {
      recommendations.push({
        id: 'external-action-review',
        title: 'External action audit required',
        description: 'This action involves external systems. Verify data flow, error handling, and rollback capabilities.',
        priority: 'high',
        requiresHumanApproval: true,
      });
    }

    const base = {
      summary: result.allowed
        ? `${systemName} action approved by policy. ${result.requiresApproval ? 'Awaiting human confirmation.' : 'Ready for execution.'}`
        : `${systemName} action blocked: ${Array.from(violationCategories).join(', ')} violations detected.`,
      findings,
      recommendations,
      auditEvents: [
        {
          actor: input.actor || 'policy-enforcement-agent',
          action: result.allowed ? 'policy_allowed' : 'policy_blocked',
          systemName,
          riskLevel,
          metadata: {
            allowed: result.allowed,
            requiresApproval: result.requiresApproval,
            violationCategories: Array.from(violationCategories),
            violationCount: result.reasons.length,
            policyModel: policy.allowed_models?.slice(0, 1),
            tenantId: input.tenantId,
          },
        },
      ],
      metadata: {
        ...result,
        violationCategories: Array.from(violationCategories),
        systemName,
      },
    };

    if (!result.allowed) return this.blocked(input, base);
    if (result.requiresApproval) return this.requiresApproval(input, base);
    return this.success(input, base);
  }
}
