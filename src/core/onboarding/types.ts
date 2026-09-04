import type { PlanId } from '@/shared/pricing';
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

// Branchen-Wertebereich liegt zentral in src/config/sectors.ts — dort steht
// auch, warum Werte ergaenzt, aber nie entfernt werden duerfen. Alias statt
// Re-Export, damit `Sector` auch in dieser Datei gebunden ist.
import type { SectorId } from '../../config/sectors';

export type Sector = SectorId;

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

// Der empfohlene Plan ist immer einer der sechs kanonischen Plaene.
export type PlanTier = PlanId;

export interface Recommendation {
  recommendedPlan: PlanTier;
  reasoning: string;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  nextSteps: string[];
  sector: Sector;
}
