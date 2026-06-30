import type { ScanFinding, ClassifiedFinding, GovernanceDimension, RiskLevel } from './types';

/**
 * Mapping: finding titles/keywords → governance dimensions
 * Used to route each finding to the right governance pillar
 */
const FINDING_DIMENSION_MAP: Record<string, GovernanceDimension> = {
  // Website Compliance & DSGVO basics
  'tracking without consent': 'website_compliance',
  'cookie banner': 'website_compliance',
  'third party scripts': 'website_compliance',
  'privacy policy': 'website_compliance',
  'consent management': 'website_compliance',
  'tracker database': 'website_compliance',

  // Monitoring
  'runtime': 'monitoring',
  'continuous': 'monitoring',
  'live scan': 'monitoring',
  'monitoring': 'monitoring',

  // AI-Act specific
  'ai act': 'aiact_governance',
  'ai model': 'aiact_governance',
  'llm': 'aiact_governance',
  'high risk ai': 'aiact_governance',
  'generative': 'aiact_governance',
  'classification': 'aiact_governance',

  // Evidence & Documentation
  'evidence': 'evidence',
  'proof': 'evidence',
  'audit trail': 'evidence',
  'documentation': 'evidence',
  'record keeping': 'evidence',

  // Policy & Automation
  'policy': 'policy_automation',
  'automation': 'policy_automation',
  'workflow': 'policy_automation',
  'enforcement': 'policy_automation',

  // Team
  'team': 'team_collaboration',
  'user': 'team_collaboration',
  'access': 'team_collaboration',
  'role': 'team_collaboration',

  // API
  'api': 'api_integration',
  'webhook': 'api_integration',
  'integration': 'api_integration',

  // Industry
  'healthcare': 'industry_specifics',
  'medical': 'industry_specifics',
  'banking': 'industry_specifics',
  'financial': 'industry_specifics',
  'public sector': 'industry_specifics',
  'government': 'industry_specifics',
};

/**
 * Determine urgency based on severity and dimension
 */
function getUrgency(severity: RiskLevel, dimension: GovernanceDimension): 'immediate' | 'soon' | 'eventual' {
  if (severity === 'critical') return 'immediate';
  if (severity === 'high') return 'soon';
  if (dimension === 'website_compliance' && severity === 'medium') return 'soon';
  return 'eventual';
}

/**
 * Classify a single finding into a governance dimension
 */
function classifySingleFinding(finding: ScanFinding): ClassifiedFinding {
  const titleLower = finding.title.toLowerCase();
  const detailLower = finding.detail.toLowerCase();
  const combined = `${titleLower} ${detailLower}`;

  // Find best matching dimension
  let bestDimension: GovernanceDimension = 'website_compliance';
  let bestScore = 0;

  for (const [keyword, dimension] of Object.entries(FINDING_DIMENSION_MAP)) {
    if (combined.includes(keyword)) {
      const score = keyword.length; // longer matches score higher
      if (score > bestScore) {
        bestScore = score;
        bestDimension = dimension;
      }
    }
  }

  // Business context based on severity and dimension
  const businessContextMap: Record<RiskLevel, Record<GovernanceDimension, string>> = {
    critical: {
      website_compliance: 'Tracking without consent violates DSGVO Art. 6 and TTDSG § 25. Regulatory enforcement likely.',
      monitoring: 'Undetected compliance drift creates liability. Continuous monitoring required for evidence.',
      aiact_governance: 'High-risk AI classification missing. EU AI Act enforcement actions possible.',
      evidence: 'No audit trail. Regulators cannot verify compliance measures.',
      policy_automation: 'Manual compliance workflows create human error. Automation required for risk mitigation.',
      team_collaboration: 'Governance responsibility unclear. Designate DPO and document delegation.',
      api_integration: 'Compliance data siloed. API integration needed for unified governance.',
      industry_specifics: 'Industry regulation violations. Sector-specific agents required.',
    },
    high: {
      website_compliance: 'DSGVO compliance gaps identified. Fix within regulatory scrutiny window.',
      monitoring: 'Compliance risk detection needed. Implement continuous scanning.',
      aiact_governance: 'AI-Act classification incomplete. Assess high-risk categories.',
      evidence: 'Insufficient proof for audits. Implement evidence retention system.',
      policy_automation: 'Manual policies create drift. Semi-automation reduces error.',
      team_collaboration: 'Governance responsibility concentrated. Distribute access controls.',
      api_integration: 'Data integration partial. Extend API coverage for workflows.',
      industry_specifics: 'Sector compliance incomplete. Implement industry best-practices.',
    },
    medium: {
      website_compliance: 'DSGVO alignment improvement possible. Routine maintenance recommended.',
      monitoring: 'Periodic monitoring recommended for consistency checks.',
      aiact_governance: 'AI-Act alignment recommended for future-proofing.',
      evidence: 'Documentation incomplete. Strengthen record-keeping practices.',
      policy_automation: 'Basic policies defined. Automation adds efficiency.',
      team_collaboration: 'Team access working. Formalize role-based governance.',
      api_integration: 'API coverage adequate. Consider webhooks for real-time sync.',
      industry_specifics: 'Industry alignment sufficient. Optional enhancements available.',
    },
    low: {
      website_compliance: 'Minor DSGVO hygiene items. Non-blocking improvements.',
      monitoring: 'Optional monitoring for advanced use cases.',
      aiact_governance: 'AI-Act future-proofing. Consider as roadmap item.',
      evidence: 'Evidence practices sufficient. Optimization possible.',
      policy_automation: 'Workflows functional. Automation nice-to-have.',
      team_collaboration: 'Team governance adequate. Growth planning recommended.',
      api_integration: 'API integration optional. Evaluate for scale.',
      industry_specifics: 'Industry alignment optional. Monitor regulatory changes.',
    },
    info: {
      website_compliance: 'Informational compliance indicator. No action required.',
      monitoring: 'Informational. Consider for advanced monitoring.',
      aiact_governance: 'Informational AI-Act hint. No immediate action.',
      evidence: 'Informational evidence note. Document for reference.',
      policy_automation: 'Informational workflow suggestion. Optional implementation.',
      team_collaboration: 'Informational team note. No action required.',
      api_integration: 'Informational API note. Optional integration.',
      industry_specifics: 'Informational sector note. No action required.',
    },
  };

  const businessContext =
    businessContextMap[finding.severity]?.[bestDimension] ||
    'Governance issue detected. Address based on severity and business context.';

  return {
    original: finding,
    dimension: bestDimension,
    businessContext,
    urgency: getUrgency(finding.severity, bestDimension),
  };
}

/**
 * Classify all findings from a scan
 */
export function classifyAllFindings(findings: ScanFinding[]): ClassifiedFinding[] {
  return findings.map(classifySingleFinding);
}

/**
 * Group classified findings by dimension for summary
 */
export function groupFindingsByDimension(classified: ClassifiedFinding[]): Map<GovernanceDimension, ClassifiedFinding[]> {
  const grouped = new Map<GovernanceDimension, ClassifiedFinding[]>();

  for (const finding of classified) {
    if (!grouped.has(finding.dimension)) {
      grouped.set(finding.dimension, []);
    }
    grouped.get(finding.dimension)!.push(finding);
  }

  return grouped;
}

/**
 * Score a dimension's criticality (0-100) based on findings
 */
export function scoreDimensionCriticality(
  findings: ClassifiedFinding[],
  dimension: GovernanceDimension
): number {
  const relevant = findings.filter((f) => f.dimension === dimension);
  if (relevant.length === 0) return 0;

  const severityWeights: Record<RiskLevel, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 1,
  };

  const totalScore = relevant.reduce((sum, f) => sum + severityWeights[f.original.severity], 0);
  return Math.min(100, totalScore);
}
