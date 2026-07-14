import type { GovernanceProfile, Recommendation, ClassifiedFinding, GovernanceAnswer } from './types';
import { scoreDimensionCriticality } from './findingClassifier';

/**
 * Score-based recommendation logic
 *
 * Starter (€39): 1 domain, basic DSGVO scan, no monitoring
 * - Single website, low risk, no continuous needs
 *
 * Professional (€149): up to 10 domains, monitoring, AI-Act, Evidence Vault
 * - Multiple domains OR continuous monitoring needed
 * - Some AI-Act compliance concerns
 *
 * Governance OS (€599): unlimited assets, policy engine, automation
 * - 10+ domains/products OR
 * - Complex governance needs (policy automation, evidence vault, team)
 * - Some high-risk AI governance
 *
 * Enterprise (Custom): Industry agents, SLA, unlimited
 * - Regulated industry (healthcare, finance, public sector)
 * - Complex AI governance
 * - 20+ team members OR 50+ domains
 */

interface RecommendationScore {
  plan: 'starter_governance' | 'professional_governance' | 'governance_os' | 'enterprise_regulated';
  score: number;
  factors: string[];
}

/**
 * Calculate base recommendation score for each dimension
 */
function scoreDimension(
  dimension: string,
  criticality: number,
  answers: GovernanceAnswer[]
): number {
  let score = criticality; // Base score from findings

  // Adjust based on user answers
  for (const answer of answers) {
    if (typeof answer.answer === 'boolean' && !answer.answer) {
      // User said "no" to capability question — indicates plan upgrade needed
      score += 10;
    }
    if (typeof answer.answer === 'string' && answer.answer === 'Gar nicht') {
      // "Not at all" indicates strong upgrade need
      score += 15;
    }
  }

  return Math.min(100, score);
}

/**
 * Generate recommendations based on profile
 */
export function generateRecommendation(profile: GovernanceProfile): Recommendation {
  const scores: RecommendationScore[] = [
    { plan: 'starter_governance', score: 0, factors: [] },
    { plan: 'professional_governance', score: 0, factors: [] },
    { plan: 'governance_os', score: 0, factors: [] },
    { plan: 'enterprise_regulated', score: 0, factors: [] },
  ];

  let totalCriticality = 0;
  const criticalDimensions: string[] = [];
  const highDimensions: string[] = [];

  // Evaluate each dimension
  for (const dim of profile.dimensions) {
    totalCriticality += dim.criticalityScore;

    if (dim.criticalityScore >= 60) {
      criticalDimensions.push(dim.dimension);
    } else if (dim.criticalityScore >= 30) {
      highDimensions.push(dim.dimension);
    }

    // Score each plan based on dimension needs
    if (dim.criticalityScore >= 70) {
      scores[1].score += 20; // Professional minimum
      scores[2].score += 10;
    }
    if (dim.criticalityScore >= 50) {
      scores[1].score += 10; // Professional
      scores[2].score += 5;
    }
    if (dim.criticalityScore >= 30) {
      scores[0].score += 5; // Starter
      scores[1].score += 3;
    }
  }

  // Industry-based adjustments
  if (profile.sector === 'healthcare' || profile.sector === 'public_sector') {
    scores[3].score += 50; // Enterprise for regulated sectors
    scores[2].score += 15;
  } else if (profile.sector === 'saas' || profile.sector === 'agency') {
    scores[2].score += 15;
    scores[1].score += 10;
  }

  // Risk level adjustments
  if (profile.riskLevel === 'critical') {
    scores[2].score += 30;
    scores[3].score += 20;
  } else if (profile.riskLevel === 'high') {
    scores[1].score += 20;
    scores[2].score += 15;
  }

  // Find the recommended plan
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const topRecommendation = sortedScores[0];

  // Ensure minimum plan recommendation
  let recommendedPlan = topRecommendation.plan;
  if (profile.riskLevel === 'critical' && recommendedPlan === 'starter_governance') {
    recommendedPlan = 'professional_governance';
  }

  // Build factors and reasoning
  const factors: string[] = [];
  const urgencyLevel = profile.riskLevel === 'critical' ? 'critical' : profile.riskLevel === 'high' ? 'high' : 'medium';

  if (criticalDimensions.length > 0) {
    factors.push(`${criticalDimensions.length} dimension(s) need urgent attention: ${criticalDimensions.join(', ')}`);
  }
  if (highDimensions.length > 0) {
    factors.push(`${highDimensions.length} dimension(s) would benefit from governance: ${highDimensions.join(', ')}`);
  }
  if (profile.sector !== 'generic') {
    factors.push(`Sector-specific considerations for ${profile.sector}`);
  }

  const planReasons: Record<string, string> = {
    starter_governance:
      'Your website has minimal compliance gaps. Website scanning and basic DSGVO checks are sufficient.',
    professional_governance:
      'You need monitoring and multiple-domain support. Evidence Vault and team access required for governance.',
    governance_os:
      'Complex governance needs detected. Policy automation, DPIA, and advanced AI-Act classification required.',
    enterprise_regulated:
      'Regulated industry + complex AI governance. Industry-specific agents and SLA essential for compliance.',
  };

  const reasoning = planReasons[recommendedPlan] || 'Governance risk assessment complete.';

  // Build next steps
  const nextSteps: string[] = [];
  if (criticalDimensions.includes('website_compliance')) {
    nextSteps.push('1. Fix critical website compliance issues immediately');
  }
  if (criticalDimensions.includes('aiact_governance')) {
    nextSteps.push('1. Classify AI systems per EU AI Act');
  }
  if (highDimensions.includes('monitoring')) {
    nextSteps.push(`${nextSteps.length + 1}. Enable continuous monitoring to detect future drift`);
  }
  if (highDimensions.includes('policy_automation')) {
    nextSteps.push(`${nextSteps.length + 1}. Automate governance policies to reduce manual effort`);
  }
  nextSteps.push(`${nextSteps.length + 1}. Set up team governance with clear roles`);
  nextSteps.push(`${nextSteps.length + 1}. Build evidence vault for audit readiness`);

  return {
    recommendedPlan,
    reasoning,
    urgencyLevel,
    nextSteps: nextSteps.slice(0, 5),
    sector: profile.sector,
  };
}

/**
 * Compare two plans to show upgrade path
 */
export function compareUpgradePath(
  currentPlan: 'starter_governance' | 'professional_governance' | 'governance_os',
  recommendedPlan: string
): string {
  const paths: Record<string, Record<string, string>> = {
    starter_governance: {
      professional_governance: 'Upgrade to Starter → Professional for monitoring + team access',
      governance_os: 'Upgrade to Starter → Professional → Governance OS for full automation',
      enterprise_regulated: 'Upgrade to full Enterprise for regulated industry + agents',
    },
    professional_governance: {
      governance_os: 'Upgrade to Professional → Governance OS for policy automation + DPIA',
      enterprise_regulated: 'Upgrade to Professional → Enterprise for industry-specific agents + SLA',
    },
    governance_os: {
      enterprise_regulated: 'Upgrade to Governance OS → Enterprise for industry agents + dedicated support',
    },
  };

  return (
    paths[currentPlan]?.[recommendedPlan] || `Consider upgrading to ${recommendedPlan} for enhanced governance capabilities`
  );
}

/**
 * Calculate months to value (time until ROI)
 */
export function estimateTimeToValue(
  plan: string,
  criticalityScore: number
): { months: number; reasoning: string } {
  if (criticalityScore >= 80) {
    return {
      months: 0.5,
      reasoning: 'Critical compliance issues — immediate ROI through risk mitigation',
    };
  }
  if (criticalityScore >= 60) {
    return {
      months: 1,
      reasoning: 'High governance needs — ROI within first month from reduced manual work',
    };
  }
  if (criticalityScore >= 40) {
    return {
      months: 2,
      reasoning: 'Moderate governance needs — ROI within 2 months from automation',
    };
  }
  return {
    months: 3,
    reasoning: 'Foundation-level needs — ROI in 3+ months from continuous monitoring',
  };
}
