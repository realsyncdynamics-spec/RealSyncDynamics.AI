import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import { getEnterpriseAgent } from './registry';

interface ReportLike {
  id?: string;
  type?: string;
  severity?: string;
  category?: string;
  title?: string;
  createdAt?: string;
}

interface ClusterAnalysis {
  cluster: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: 'user_blocking' | 'workflow_impact' | 'performance' | 'minor';
  trend: 'increasing' | 'stable' | 'decreasing';
  affectedUsers: number;
}

export class FeedbackIntelligenceAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('feedback-intelligence-agent');
    if (!definition) throw new Error('Feedback Intelligence Agent definition missing');
    super(definition);
  }

  private categorizeReport(report: ReportLike): string {
    if (report.type === 'bug') {
      const title = String(report.title || '').toLowerCase();
      if (title.includes('crash') || title.includes('error')) return 'critical_bugs';
      if (title.includes('performance') || title.includes('slow')) return 'performance_bugs';
      return 'general_bugs';
    }
    if (report.type === 'feature_request') {
      const title = String(report.title || '').toLowerCase();
      if (title.includes('api') || title.includes('integration')) return 'integration_features';
      if (title.includes('security') || title.includes('compliance')) return 'compliance_features';
      return 'ux_features';
    }
    return report.category || 'other';
  }

  private assessImpact(severity: string, reportType: string): 'user_blocking' | 'workflow_impact' | 'performance' | 'minor' {
    if (severity === 'critical' && reportType === 'bug') return 'user_blocking';
    if (severity === 'high' && reportType === 'bug') return 'workflow_impact';
    if (reportType === 'bug') return 'performance';
    return 'minor';
  }

  private analyzeClusters(reports: ReportLike[]): ClusterAnalysis[] {
    const clusters = new Map<string, ReportLike[]>();

    reports.forEach((report) => {
      const cluster = this.categorizeReport(report);
      if (!clusters.has(cluster)) {
        clusters.set(cluster, []);
      }
      clusters.get(cluster)!.push(report);
    });

    return Array.from(clusters.entries()).map(([cluster, clusterReports]) => {
      const severities = clusterReports.map((r) => r.severity || 'medium');
      const maxSeverity = severities.includes('critical')
        ? 'critical'
        : severities.includes('high')
          ? 'high'
          : 'medium';

      const reportTypes = clusterReports.map((r) => r.type || 'other');
      const impact = this.assessImpact(maxSeverity, reportTypes[0]);

      return {
        cluster,
        count: clusterReports.length,
        severity: maxSeverity as 'critical' | 'high' | 'medium' | 'low',
        impact,
        trend: clusterReports.length > 5 ? 'increasing' : 'stable',
        affectedUsers: new Set(clusterReports.map((r) => r.id)).size,
      };
    });
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const reports: ReportLike[] = Array.isArray(input.payload.reports)
      ? (input.payload.reports as ReportLike[])
      : [];

    if (reports.length === 0) {
      return this.success(input, {
        summary: 'No feedback reports to analyze.',
        findings: [],
        recommendations: [],
        auditEvents: [
          {
            actor: input.actor || 'feedback-intelligence-agent',
            action: 'feedback_analysis_empty',
            riskLevel: 'minimal',
            metadata: { tenantId: input.tenantId },
          },
        ],
        metadata: { reportCount: 0 },
      });
    }

    const clusters = this.analyzeClusters(reports);
    const criticalClusters = clusters.filter((c) => c.severity === 'critical');
    const userBlockingClusters = clusters.filter((c) => c.impact === 'user_blocking');

    const findings: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      riskLevel: 'minimal' | 'limited' | 'high' | 'prohibited';
      evidence: Record<string, unknown>;
    }> = clusters.map((cluster, index) => ({
      id: `feedback-cluster-${index}`,
      title: `${cluster.cluster}: ${cluster.count} reports`,
      description: `Cluster impact: ${cluster.impact}. Trend: ${cluster.trend}. Affects ${cluster.affectedUsers} unique reporters.`,
      severity: cluster.severity,
      riskLevel: cluster.severity === 'critical' ? 'high' : 'limited',
      evidence: { cluster: cluster.cluster, count: cluster.count, impact: cluster.impact },
    }));

    const recommendations = [];

    if (criticalClusters.length > 0) {
      recommendations.push({
        id: 'critical-remediation',
        title: 'Urgent: Address critical feedback clusters',
        description: `${criticalClusters.length} critical cluster(s) detected. Prioritize fixes for: ${criticalClusters.map((c) => c.cluster).join(', ')}`,
        priority: 'urgent' as const,
        requiresHumanApproval: true,
      });
    }

    if (userBlockingClusters.length > 0) {
      recommendations.push({
        id: 'user-blocking-fix',
        title: 'User-blocking issues require immediate attention',
        description: `${userBlockingClusters.length} user-blocking cluster(s) found. Create hotfix tickets for: ${userBlockingClusters.map((c) => c.cluster).join(', ')}`,
        priority: 'urgent' as const,
        requiresHumanApproval: true,
      });
    }

    recommendations.push({
      id: 'roadmap-planning',
      title: 'Integrate feedback into roadmap planning',
      description: `Based on ${reports.length} reports across ${clusters.length} clusters, update product roadmap and prioritization.`,
      priority: 'high' as const,
      requiresHumanApproval: true,
    });

    return this.requiresApproval(input, {
      summary: `Analyzed ${reports.length} feedback reports into ${clusters.length} clusters. ${criticalClusters.length} critical, ${userBlockingClusters.length} user-blocking.`,
      findings,
      recommendations,
      auditEvents: [
        {
          actor: input.actor || 'feedback-intelligence-agent',
          action: 'feedback_analysis_complete',
          riskLevel: criticalClusters.length > 0 ? 'high' : 'limited',
          metadata: {
            reportCount: reports.length,
            clusterCount: clusters.length,
            criticalClusters: criticalClusters.length,
            userBlockingClusters: userBlockingClusters.length,
            topClusters: clusters.slice(0, 3).map((c) => c.cluster),
            tenantId: input.tenantId,
          },
        },
      ],
      metadata: {
        reportCount: reports.length,
        clusterCount: clusters.length,
        clusters: clusters.map((c) => ({ cluster: c.cluster, count: c.count, impact: c.impact })),
        criticalCount: criticalClusters.length,
        userBlockingCount: userBlockingClusters.length,
      },
    });
  }
}
