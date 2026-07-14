// Type system for post-scan guided onboarding flow

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type GovernanceDimension =
  | 'website_compliance'    // DSGVO basic scanning
  | 'monitoring'            // Continuous monitoring
  | 'aiact_governance'      // AI-Act classification & assessment
  | 'evidence'              // Evidence vault & documentation
  | 'policy_automation'     // Policy engine & automation
  | 'team_collaboration'    // Team access & governance
  | 'api_integration'       // API & webhook capabilities
  | 'industry_specifics';   // Industry-specific agents

export type Sector = 'saas' | 'agency' | 'healthcare' | 'public_sector' | 'generic';

export interface ScanFinding {
  id: string;
  severity: RiskLevel;
  title: string;
  detail: string;
  paragraph_ref?: string;
}

export interface ClassifiedFinding {
  original: ScanFinding;
  dimension: GovernanceDimension;
  businessContext: string;
  urgency: 'immediate' | 'soon' | 'eventual';
}

export interface GovernanceQuestion {
  id: string;
  dimension: GovernanceDimension;
  question: string;
  hint?: string;
  answerType: 'yes_no' | 'scale' | 'text' | 'multiple_choice';
  options?: string[];
  triggeredByFindings?: string[];
}

export interface GovernanceAnswer {
  questionId: string;
  answer: boolean | number | string | string[];
  timestamp: number;
}

export interface GovernanceProfile {
  scanId: string;
  domain: string;
  sector: Sector;
  riskLevel: RiskLevel;
  findings: ClassifiedFinding[];
  answers: GovernanceAnswer[];
  dimensions: {
    dimension: GovernanceDimension;
    criticalityScore: number;
    needsAddressing: boolean;
    recommendedPlan: PlanTier;
  }[];
}

export type PlanTier = 'starter_governance' | 'professional_governance' | 'governance_os' | 'enterprise_regulated';

export interface Recommendation {
  recommendedPlan: PlanTier;
  reasoning: string;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  nextSteps: string[];
  sector: Sector;
}
