import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

interface ReportLike {
  type?: string;
  severity?: string;
}

export class FeedbackIntelligenceAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('feedback-intelligence-agent');
    if (!definition) throw new Error('Feedback Intelligence Agent definition missing');
    super(definition);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const reports: ReportLike[] = Array.isArray(input.payload.reports)
      ? (input.payload.reports as ReportLike[])
      : [];

    const criticalCount = reports.filter((r) => r.severity === 'critical').length;
    const bugCount = reports.filter((r) => r.type === 'bug').length;
    const featureCount = reports.filter((r) => r.type === 'feature_request').length;

    return this.requiresApproval(input, {
      summary: `Analyzed ${reports.length} feedback reports.`,
      findings: [
        {
          id: 'feedback-summary',
          title: 'Feedback cluster summary',
          description: `${bugCount} bugs, ${featureCount} feature requests, ${criticalCount} critical reports.`,
          severity: criticalCount > 0 ? 'critical' : 'medium',
          riskLevel: criticalCount > 0 ? 'high' : 'limited',
          evidence: { bugCount, featureCount, criticalCount },
        },
      ],
      recommendations: [
        {
          id: 'roadmap-review',
          title: 'Review feedback for roadmap',
          description:
            'Clustered feedback should be reviewed by product owner before roadmap changes.',
          priority: criticalCount > 0 ? 'urgent' : 'medium',
          requiresHumanApproval: true,
        },
      ],
      auditEvents: [
        {
          actor: input.actor || 'feedback-intelligence-agent',
          action: 'feedback_analyzed',
          riskLevel: criticalCount > 0 ? 'high' : 'limited',
          metadata: { bugCount, featureCount, criticalCount, tenantId: input.tenantId },
        },
      ],
      metadata: { bugCount, featureCount, criticalCount },
    });
  }
}
