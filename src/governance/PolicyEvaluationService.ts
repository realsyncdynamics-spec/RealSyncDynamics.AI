/**
 * Policy Evaluation Service — Core compliance evaluation engine.
 * Reusable policy evaluator supporting AI Act, GDPR, and custom policies.
 */

import { randomUUID } from 'crypto';
import {
  PolicyContext,
  PolicyEvaluation,
  Finding,
  ComplianceStatus,
  SimulationDraft,
  SimulationResult,
  AISystem,
  PolicyDefinition,
  PolicyControl
} from './types';
import { AIActClassifier } from './AIActClassifier';
import { GDPRChecker } from './GDPRChecker';

/**
 * Evaluates AI systems against compliance policies.
 * Produces explainable evaluation results with remediation guidance.
 */
export class PolicyEvaluationService {
  private auditLog: Map<string, Record<string, unknown>> = new Map();

  /**
   * Evaluate an AI system against a policy.
   *
   * Returns detailed evaluation with:
   * - Compliance status (compliant/non-compliant/partial)
   * - Findings (violations, gaps, recommendations)
   * - Risk score (0-100)
   * - Explainable reasoning
   */
  async evaluate(
    context: PolicyContext,
    system: AISystem,
    policy: PolicyDefinition
  ): Promise<PolicyEvaluation> {
    const evaluationId = randomUUID().toString();
    const findings: Finding[] = [];
    const controlStatus = new Map<string, ComplianceStatus>();
    let overallCompliant = true;

    // Evaluate each control
    for (const control of policy.controls) {
      const result = this.evaluateControl(control, system, policy);
      controlStatus.set(control.controlId, result.status);

      if (result.status === 'non-compliant') {
        overallCompliant = false;
        findings.push(...result.findings);
      } else if (result.status === 'partial') {
        findings.push(...result.findings);
      }
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      policy,
      system,
      findings,
      controlStatus
    );

    // Generate explanation
    const explanation = this.generateExplanation(
      system,
      policy,
      findings,
      overallCompliant
    );

    // Log evaluation
    this.logEvaluation(evaluationId, context, findings, overallCompliant);

    const evaluation: PolicyEvaluation = {
      id: evaluationId,
      policyId: policy.id,
      policyVersion: policy.version,
      aiSystemId: system.id,
      compliant: overallCompliant,
      status: overallCompliant ? 'compliant' : 'non-compliant',
      findings,
      controlStatus,
      explanation,
      riskScore,
      decidedAt: new Date(),
      expiresAt: this.calculateExpiryDate(policy),
      correlationId: context.correlationId
    };

    return evaluation;
  }

  /**
   * Evaluate a single control.
   */
  private evaluateControl(
    control: PolicyControl,
    system: AISystem,
    policy: PolicyDefinition
  ): { status: ComplianceStatus; findings: Finding[] } {
    const findings: Finding[] = [];
    let status = control.status || 'unknown';

    // Check AI Act requirements
    if (policy.riskClass === 'prohibited') {
      findings.push({
        id: randomUUID().toString(),
        severity: 'critical',
        category: 'ai-act',
        title: 'Prohibited Use Case',
        description: 'This AI system falls under a prohibited use case per EU AI Act Article 5',
        controlId: control.controlId
      });
      status = 'non-compliant';
    }

    // Check GDPR requirements
    if (!control.lastVerifiedAt) {
      const daysSinceVerified = Infinity;
      if (daysSinceVerified > 90) {
        findings.push({
          id: randomUUID().toString(),
          severity: 'medium',
          category: 'governance',
          title: 'Control Verification Expired',
          description: `Control "${control.name}" has not been verified in 90+ days`,
          controlId: control.controlId,
          remediationSteps: ['Re-verify control status', 'Update evidence', 'Document findings']
        });
      }
    }

    // Check evidence
    if (status === 'compliant' && (!control.evidence || control.evidence.length === 0)) {
      findings.push({
        id: randomUUID().toString(),
        severity: 'low',
        category: 'audit',
        title: 'Missing Evidence',
        description: `No evidence provided for control "${control.name}"`,
        controlId: control.controlId,
        remediationSteps: ['Collect evidence', 'Link to evidence repository']
      });
    }

    return { status, findings };
  }

  /**
   * Simulate policy compliance for a draft policy.
   */
  async simulatePolicy(
    aiSystemId: string,
    draft: SimulationDraft,
    system: AISystem
  ): Promise<SimulationResult> {
    const simulationId = randomUUID().toString();
    const findings: Finding[] = [];
    const recommendations: string[] = [];
    const criticalGaps: string[] = [];

    // Simulate AI Act compliance
    const aiActAnalysis = AIActClassifier.analyze(system);
    if (aiActAnalysis.riskClass === draft.riskClass) {
      recommendations.push('Risk class accurately identified');
    } else {
      recommendations.push(
        `⚠️ Risk class mismatch: Expected ${aiActAnalysis.riskClass}, got ${draft.riskClass}`
      );
      criticalGaps.push(`Risk classification (expected: ${aiActAnalysis.riskClass})`);
    }

    // Simulate control coverage
    const requiredControls = aiActAnalysis.requirements.minimumControls;
    const providedControls = draft.controls.length;
    const complianceScore = Math.min(100, (providedControls / requiredControls) * 100);

    if (providedControls < requiredControls) {
      criticalGaps.push(
        `Missing ${requiredControls - providedControls} required controls`
      );
      recommendations.push(
        `Add ${requiredControls - providedControls} more controls to meet minimum requirements`
      );
    }

    // Estimate compliance time
    const estimatedHours = Math.max(40, (requiredControls - providedControls) * 8);

    return {
      draftId: draft.id,
      simulationId,
      compliant: complianceScore === 100,
      complianceScore: Math.round(complianceScore),
      findings,
      recommendations,
      estimatedComplianceTime: estimatedHours,
      criticalGaps
    };
  }

  /**
   * Calculate overall risk score (0-100).
   */
  private calculateRiskScore(
    policy: PolicyDefinition,
    system: AISystem,
    findings: Finding[],
    controlStatus: Map<string, ComplianceStatus>
  ): number {
    let score = 0;

    // Base score on risk class
    switch (policy.riskClass) {
      case 'prohibited':
        score = 100;
        break;
      case 'high':
        score = 75;
        break;
      case 'limited':
        score = 50;
        break;
      case 'minimal':
      default:
        score = 25;
    }

    // Adjust based on findings
    const criticalFindings = findings.filter((f) => f.severity === 'critical').length;
    const highFindings = findings.filter((f) => f.severity === 'high').length;

    score += criticalFindings * 10;
    score += highFindings * 5;

    // Adjust based on control status
    let nonCompliantControls = 0;
    for (const status of controlStatus.values()) {
      if (status === 'non-compliant') nonCompliantControls++;
    }

    const nonCompliantPercentage = (nonCompliantControls / controlStatus.size) * 100;
    score += (nonCompliantPercentage / 10) * 5;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Generate human-readable explanation of evaluation.
   */
  private generateExplanation(
    system: AISystem,
    policy: PolicyDefinition,
    findings: Finding[],
    compliant: boolean
  ): string {
    const parts: string[] = [];

    parts.push(`AI System: ${system.name}`);
    parts.push(`Policy: ${policy.name} (v${policy.version})`);
    parts.push(
      `Status: ${compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`
    );

    if (findings.length === 0) {
      parts.push('No findings.');
    } else {
      parts.push(`\nFindings (${findings.length}):`);

      const bySeverity = new Map<string, Finding[]>();
      for (const finding of findings) {
        if (!bySeverity.has(finding.severity)) {
          bySeverity.set(finding.severity, []);
        }
        bySeverity.get(finding.severity)!.push(finding);
      }

      for (const [severity, items] of bySeverity.entries()) {
        parts.push(`\n${severity.toUpperCase()} (${items.length}):`);
        for (const item of items) {
          parts.push(`  - ${item.title}`);
        }
      }
    }

    parts.push('\nRecommendations:');
    if (findings.length > 0) {
      parts.push('1. Address all critical findings immediately');
      parts.push('2. Document remediation plans for high-severity findings');
      parts.push('3. Schedule control re-verification within 30 days');
    } else {
      parts.push('1. Maintain current control status');
      parts.push('2. Schedule periodic re-verification (quarterly)');
      parts.push('3. Monitor for regulatory changes');
    }

    return parts.join('\n');
  }

  /**
   * Calculate evaluation expiry date.
   */
  private calculateExpiryDate(policy: PolicyDefinition): Date {
    // Evaluations valid for 90 days
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    return expiryDate;
  }

  /**
   * Log evaluation for audit trail.
   */
  private logEvaluation(
    evaluationId: string,
    context: PolicyContext,
    findings: Finding[],
    compliant: boolean
  ): void {
    this.auditLog.set(evaluationId, {
      evaluationId,
      policyId: context.policyId,
      aiSystemId: context.aiSystemId,
      compliant,
      findingCount: findings.length,
      timestamp: new Date(),
      correlationId: context.correlationId
    });
  }

  /**
   * Get audit log entries for a policy or system.
   */
  getAuditTrail(policyId?: string, aiSystemId?: string): Record<string, unknown>[] {
    const entries: Record<string, unknown>[] = [];

    for (const entry of this.auditLog.values()) {
      if (policyId && entry.policyId !== policyId) continue;
      if (aiSystemId && entry.aiSystemId !== aiSystemId) continue;
      entries.push(entry);
    }

    return entries.sort((a, b) => {
      const timeA = (a.timestamp as Date).getTime();
      const timeB = (b.timestamp as Date).getTime();
      return timeB - timeA;
    });
  }
}

/**
 * Singleton instance for global access.
 */
export const policyEvaluationService = new PolicyEvaluationService();
