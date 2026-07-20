import { BaseEnterpriseAgent } from './base-agent';
import type { AgentRunInput, AgentRunResult } from './types';
import type { AiRiskLevel } from '../types';
import { getEnterpriseAgent } from './registry';

interface RiskFactors {
  dataRisk: number;
  usageRisk: number;
  complianceRisk: number;
  automationRisk: number;
}

export class RiskClassificationAgent extends BaseEnterpriseAgent {
  constructor() {
    const definition = getEnterpriseAgent('risk-classification-agent');
    if (!definition) throw new Error('Risk Classification Agent definition missing');
    super(definition);
  }

  private calculateRiskScore(factors: RiskFactors): AiRiskLevel {
    const total = factors.dataRisk + factors.usageRisk + factors.complianceRisk + factors.automationRisk;
    const avg = total / 4;

    if (avg >= 9) return 'prohibited';
    if (avg >= 7) return 'high';
    if (avg >= 4) return 'limited';
    return 'minimal';
  }

  private assessDataRisk(categories: string[]): number {
    const sensitiveMap: Record<string, number> = {
      health_data: 10,
      biometric_data: 10,
      genetic_data: 10,
      payroll_data: 9,
      financial_data: 9,
      criminal_data: 10,
      location_data: 7,
      pii: 8,
      special_category: 9,
    };

    const categoryRisks = categories.map((c) => sensitiveMap[c.toLowerCase()] || 3);
    return categoryRisks.length > 0 ? Math.max(...categoryRisks) : 2;
  }

  private assessUsageRisk(context: string): number {
    const highRiskContexts: [string, number][] = [
      ['social scoring', 10],
      ['manipulation', 10],
      ['discrimination', 10],
      ['law enforcement', 9],
      ['employment decision', 8],
      ['credit decision', 8],
      ['admission', 7],
      ['benefit determination', 7],
      ['healthcare treatment', 8],
      ['education', 6],
      ['marketing', 4],
      ['analytics', 3],
      ['content recommendation', 5],
    ];

    const lower = context.toLowerCase();
    for (const [ctx, risk] of highRiskContexts) {
      if (lower.includes(ctx)) return risk;
    }
    return 2;
  }

  private assessComplianceRisk(categories: string[], context: string): number {
    const gdprArticles: Record<string, number> = {
      art_9: 9, // Special categories
      art_6: 5, // Lawfulness of processing
      art_35: 7, // DPIA required
      art_32: 6, // Security
    };

    const aiActArticles: Record<string, number> = {
      prohibited: 10,
      high_risk: 8,
      limited_risk: 4,
      minimal_risk: 1,
    };

    const lower = context.toLowerCase();
    let complianceRisk = 3;

    if (categories.some((c) => c.toLowerCase().includes('special'))) {
      complianceRisk = Math.max(complianceRisk, gdprArticles.art_9);
    }

    if (lower.includes('profiling') || lower.includes('automated decision')) {
      complianceRisk = Math.max(complianceRisk, gdprArticles.art_35);
    }

    return Math.min(complianceRisk, 9);
  }

  private assessAutomationRisk(context: string): number {
    const lower = context.toLowerCase();

    if (lower.includes('full automation') || lower.includes('autonomous')) return 9;
    if (lower.includes('augmentation') || lower.includes('human review')) return 3;
    if (lower.includes('decision support')) return 5;

    return 4;
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const dataCategories = Array.isArray(input.payload.dataCategories)
      ? (input.payload.dataCategories as unknown[]).map(String)
      : [];
    const usageContext = String(input.payload.usageContext || '').toLowerCase();
    const systemName = String(input.payload.systemName || 'unknown');

    const factors: RiskFactors = {
      dataRisk: this.assessDataRisk(dataCategories),
      usageRisk: this.assessUsageRisk(usageContext),
      complianceRisk: this.assessComplianceRisk(dataCategories, usageContext),
      automationRisk: this.assessAutomationRisk(usageContext),
    };

    const riskLevel = this.calculateRiskScore(factors);
    const requiresApproval = riskLevel === 'high' || riskLevel === 'prohibited';

    const factorExplanations = [
      `Data Risk: ${factors.dataRisk}/10 (${dataCategories.join(', ') || 'none'})`,
      `Usage Risk: ${factors.usageRisk}/10 (${usageContext || 'general'})`,
      `Compliance Risk: ${factors.complianceRisk}/10`,
      `Automation Risk: ${factors.automationRisk}/10`,
    ];

    return this.requiresApproval(input, {
      summary: `${systemName} classified as ${riskLevel}. Weighted risk assessment: ${((factors.dataRisk + factors.usageRisk + factors.complianceRisk + factors.automationRisk) / 4).toFixed(1)}/10`,
      findings: [
        {
          id: 'risk-classification',
          title: `AI Risk Classification: ${riskLevel.toUpperCase()}`,
          description: `System ${systemName} assessed via multi-factor analysis:\n${factorExplanations.join('\n')}`,
          severity:
            riskLevel === 'prohibited'
              ? 'critical'
              : riskLevel === 'high'
                ? 'high'
                : riskLevel === 'limited'
                  ? 'medium'
                  : 'low',
          riskLevel,
          evidence: { dataCategories, usageContext, factors },
        },
      ],
      recommendations: [
        {
          id: 'governance-review',
          title: requiresApproval ? 'Governance approval required' : 'Continue monitoring',
          description: requiresApproval
            ? `${systemName} requires compliance and governance sign-off before deployment. Document DPIA and risk mitigation.`
            : `Document usage and establish monitoring baseline for ${systemName}.`,
          priority: requiresApproval ? 'urgent' : 'medium',
          requiresHumanApproval: requiresApproval,
        },
      ],
      auditEvents: [
        {
          actor: input.actor || 'risk-classification-agent',
          action: 'risk_classified',
          systemName,
          riskLevel,
          metadata: {
            dataCategories,
            usageContext,
            riskFactors: factors,
            overallScore: (factors.dataRisk + factors.usageRisk + factors.complianceRisk + factors.automationRisk) / 4,
            tenantId: input.tenantId,
          },
        },
      ],
      metadata: { riskLevel, requiresApproval, factors },
    });
  }
}
