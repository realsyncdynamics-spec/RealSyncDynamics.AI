/**
 * EU AI Act requirement-level compliance assessments.
 *
 * Mirrors:
 * - docs/compliance/ai-act-requirement-catalog.json
 * - docs/compliance/ai-act-compliance-assessment.schema.json
 * - supabase/migrations/20260819053000_ai_act_compliance_assessments.sql
 *
 * Distinct from system classification (`ai_act_assessments` / AiActClass).
 * Chain: Requirement → Assessment → Evidence → Finding → Remediation → Review.
 * Art. 50 is a separate article from Art. 13 (link via relatedRequirementIds only).
 */

export type AiActRegulation = 'EU_AI_ACT';

/** Articles covered by the requirement catalog. */
export type AiActComplianceArticle = 9 | 10 | 11 | 12 | 13 | 14 | 15 | 50;

export type AiActComplianceStatus =
  | 'open'
  | 'partial'
  | 'satisfied'
  | 'not_applicable'
  | 'blocked';

export type AiActRemediationStatus =
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type AiActClassificationBasis =
  | 'annex_iii'
  | 'annex_i'
  | 'art_6_3_not_high_risk'
  | 'not_in_scope'
  | 'undetermined';

export type AiActComplianceRiskLevel =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface AiActRemediation {
  summary: string;
  steps?: string[];
  owner?: string | null;
  dueAt?: string | null;
  status: AiActRemediationStatus;
}

export interface AiActClassificationContext {
  highRisk?: boolean;
  basis?: AiActClassificationBasis;
  annexIiiArea?: string | null;
  rationale?: string | null;
}

/** One assessment row per (asset, requirement). */
export interface AiActComplianceAssessment {
  id: string;
  tenantId: string;
  assetId: string;
  regulation: AiActRegulation;
  article: AiActComplianceArticle;
  requirementId: string;
  status: AiActComplianceStatus;
  applicabilityReason?: string | null;
  evidenceIds: string[];
  findingIds: string[];
  policyId?: string | null;
  owner?: string | null;
  reviewer?: string | null;
  assessedAt: string;
  dueAt?: string | null;
  nextReviewAt?: string | null;
  remediation?: AiActRemediation | null;
  riskLevel?: AiActComplianceRiskLevel | null;
  relatedRequirementIds: string[];
  classificationContext?: AiActClassificationContext | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/** Snake_case row as returned from Supabase. */
export interface DbAiActComplianceAssessment {
  id: string;
  tenant_id: string;
  asset_id: string;
  regulation: AiActRegulation;
  article: AiActComplianceArticle;
  requirement_id: string;
  status: AiActComplianceStatus;
  applicability_reason: string | null;
  evidence_ids: string[];
  finding_ids: string[];
  policy_id: string | null;
  owner: string | null;
  reviewer: string | null;
  assessed_at: string;
  due_at: string | null;
  next_review_at: string | null;
  remediation: {
    summary: string;
    steps?: string[];
    owner?: string | null;
    due_at?: string | null;
    status: AiActRemediationStatus;
  } | null;
  risk_level: AiActComplianceRiskLevel | null;
  related_requirement_ids: string[];
  classification_context: {
    high_risk?: boolean;
    basis?: AiActClassificationBasis;
    annex_iii_area?: string | null;
    rationale?: string | null;
  } | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function mapDbAiActComplianceAssessment(
  row: DbAiActComplianceAssessment,
): AiActComplianceAssessment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    assetId: row.asset_id,
    regulation: row.regulation,
    article: row.article,
    requirementId: row.requirement_id,
    status: row.status,
    applicabilityReason: row.applicability_reason,
    evidenceIds: row.evidence_ids ?? [],
    findingIds: row.finding_ids ?? [],
    policyId: row.policy_id,
    owner: row.owner,
    reviewer: row.reviewer,
    assessedAt: row.assessed_at,
    dueAt: row.due_at,
    nextReviewAt: row.next_review_at,
    remediation: row.remediation
      ? {
          summary: row.remediation.summary,
          steps: row.remediation.steps,
          owner: row.remediation.owner,
          dueAt: row.remediation.due_at,
          status: row.remediation.status,
        }
      : null,
    riskLevel: row.risk_level,
    relatedRequirementIds: row.related_requirement_ids ?? [],
    classificationContext: row.classification_context
      ? {
          highRisk: row.classification_context.high_risk,
          basis: row.classification_context.basis,
          annexIiiArea: row.classification_context.annex_iii_area,
          rationale: row.classification_context.rationale,
        }
      : null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** High-risk articles only (excludes Art. 50). */
export const AI_ACT_HIGH_RISK_ARTICLES: AiActComplianceArticle[] = [
  9, 10, 11, 12, 13, 14, 15,
];

/** Transparency block (applies from 2026-08-02; independent of high-risk). */
export const AI_ACT_TRANSPARENCY_ARTICLE: AiActComplianceArticle = 50;

export function isArt50Requirement(requirementId: string): boolean {
  return requirementId.startsWith('50.');
}

export function articleFromRequirementId(
  requirementId: string,
): AiActComplianceArticle | null {
  const n = Number(requirementId.split('.')[0]);
  if ([9, 10, 11, 12, 13, 14, 15, 50].includes(n)) {
    return n as AiActComplianceArticle;
  }
  return null;
}
