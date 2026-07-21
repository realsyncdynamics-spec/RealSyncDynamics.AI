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

  private generateRemediationSteps(riskLevel: AiRiskLevel, issue: string, issueType: string): Array<{
    id: string;
    title: string;
    description: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    requiresHumanApproval: boolean;
  }> {
    const steps: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'urgent' | 'high' | 'medium' | 'low';
      requiresHumanApproval: boolean;
    }> = [];

    if (riskLevel === 'prohibited') {
      steps.push({
        id: 'immediate-freeze',
        title: '[URGENT] Immediately stop all usage',
        description: `All uses of this system must cease immediately pending full compliance review. Notify affected teams and stakeholders within 2 hours.`,
        priority: 'urgent' as const,
        requiresHumanApproval: true,
      });

      steps.push({
        id: 'emergency-assessment',
        title: '[URGENT] Conduct emergency compliance assessment',
        description: 'Engage legal, compliance, and DPO for immediate GDPR/DPIA impact review and AI Act assessment.',
        priority: 'urgent' as const,
        requiresHumanApproval: true,
      });
    } else if (riskLevel === 'high') {
      steps.push({
        id: 'limited-pause',
        title: 'Pause new usage pending review',
        description: 'Stop new deployments and external usage. Existing uses may continue under monitoring.',
        priority: 'high' as const,
        requiresHumanApproval: true,
      });

      steps.push({
        id: 'risk-assessment',
        title: 'Comprehensive risk assessment',
        description: 'Conduct DPIA, vendor security assessment, and policy alignment review.',
        priority: 'high' as const,
        requiresHumanApproval: true,
      });
    }

    steps.push({
      id: 'document-context',
      title: 'Document full processing context',
      description: `Purpose: ${issueType || 'See findings'}\nData categories: [PII/Special Categories]\nModel provider: [Vendor]\nApproval path: [Ownership chain]`,
      priority: riskLevel === 'high' ? ('high' as const) : ('medium' as const),
      requiresHumanApproval: true,
    });

    if (issueType.toLowerCase().includes('data')) {
      steps.push({
        id: 'data-controls',
        title: 'Implement data protection controls',
        description: 'Restrict sensitive data categories, apply masking, implement audit logging.',
        priority: 'high' as const,
        requiresHumanApproval: true,
      });
    }

    if (issueType.toLowerCase().includes('external')) {
      steps.push({
        id: 'external-controls',
        title: 'Control external integrations',
        description: 'Implement API filtering, rate limiting, error handling, and rollback procedures.',
        priority: 'high' as const,
        requiresHumanApproval: true,
      });
    }

    steps.push({
      id: 'policy-enforcement',
      title: 'Attach agent policy',
      description: 'Create tenant policy restricting sensitive data, external actions, and defining approval requirements.',
      priority: 'high' as const,
      requiresHumanApproval: true,
    });

    steps.push({
      id: 'compliance-review',
      title: 'Obtain compliance sign-off',
      description: 'Get approval from Compliance Lead and optionally Data Protection Officer.',
      priority: 'high' as const,
      requiresHumanApproval: true,
    });

    if (riskLevel === 'prohibited') {
      steps.push({
        id: 'remediation-or-decommission',
        title: 'Remediation or decommissioning decision',
        description: 'If remediation is possible, outline steps. Otherwise, plan deprecation and alternative.',
        priority: 'urgent' as const,
        requiresHumanApproval: true,
      });
    }

    return steps;
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const riskLevel = ((input.payload.riskLevel as AiRiskLevel) || 'unknown') as AiRiskLevel;
    const issue = String(input.payload.issue || 'Unspecified governance issue');
    const issueType = String(input.payload.issueType || 'compliance');
    const systemName = String(input.payload.systemName || 'unknown');

    const priority: 'urgent' | 'high' | 'medium' =
      riskLevel === 'prohibited' ? 'urgent' : riskLevel === 'high' ? 'high' : 'medium';

    const recommendations = this.generateRemediationSteps(riskLevel, issue, issueType);

    const criticalSteps = recommendations.filter((r) => r.priority === 'urgent');

    return this.requiresApproval(input, {
      summary: `Remediation plan for ${systemName}: ${criticalSteps.length} urgent step(s), ${recommendations.length} total. Human approval required.`,
      findings: [
        {
          id: 'remediation-target',
          title: `Risk level: ${riskLevel}`,
          description: issue,
          severity: riskLevel === 'prohibited' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium',
          riskLevel,
          evidence: { issueType, systemName },
        },
      ],
      recommendations,
      auditEvents: [
        {
          actor: input.actor || 'remediation-agent',
          action: 'remediation_plan_created',
          systemName,
          riskLevel,
          metadata: {
            issue,
            issueType,
            stepCount: recommendations.length,
            urgentSteps: criticalSteps.length,
            tenantId: input.tenantId,
          },
        },
      ],
      metadata: {
        priority,
        issue,
        issueType,
        systemName,
        stepCount: recommendations.length,
        urgentSteps: criticalSteps.length,
      },
    });
  }
}
