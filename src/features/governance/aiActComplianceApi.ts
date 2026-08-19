/**
 * Supabase API for ai_act_compliance_assessments.
 * Reads/writes are tenant-scoped via RLS (is_tenant_member).
 */
import { getSupabase } from '../../lib/supabase';
import {
  mapDbAiActComplianceAssessment,
  type AiActComplianceArticle,
  type AiActComplianceAssessment,
  type AiActComplianceStatus,
  type AiActRemediation,
  type AiActClassificationContext,
  type AiActComplianceRiskLevel,
  type DbAiActComplianceAssessment,
} from './aiActCompliance';
import {
  AI_ACT_REQUIREMENT_CATALOG,
  type AiActCatalogRequirement,
} from './aiActRequirementCatalog';

export interface SeedOptions {
  /** Default: all catalog rows. Set true to skip high-risk-only when asset is not high-risk. */
  highRisk?: boolean;
  /** Include Art. 50 transparency block (default true). */
  includeArt50?: boolean;
  owner?: string | null;
}

export interface SeedResult {
  ok: boolean;
  inserted: number;
  skipped: number;
  assessments?: AiActComplianceAssessment[];
  error?: { code: string; message: string };
}

function selectCatalog(opts: SeedOptions): AiActCatalogRequirement[] {
  const includeArt50 = opts.includeArt50 !== false;
  return AI_ACT_REQUIREMENT_CATALOG.filter((r) => {
    if (r.article === 50) return includeArt50;
    if (r.highRiskOnly && opts.highRisk === false) return false;
    return true;
  });
}

/**
 * Ensure one assessment row per selected catalog requirement for the asset.
 * Existing rows are left unchanged (upsert on conflict do nothing via unique index).
 */
export async function seedAiActComplianceAssessments(
  tenantId: string,
  assetId: string,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  const catalog = selectCatalog(opts);
  if (catalog.length === 0) {
    return { ok: true, inserted: 0, skipped: 0, assessments: [] };
  }

  const sb = getSupabase();
  const now = new Date().toISOString();

  const rows = catalog.map((r) => ({
    tenant_id: tenantId,
    asset_id: assetId,
    regulation: 'EU_AI_ACT' as const,
    article: r.article,
    requirement_id: r.requirementId,
    status: 'open' as const,
    evidence_ids: [] as string[],
    finding_ids: [] as string[],
    owner: opts.owner ?? null,
    assessed_at: now,
    related_requirement_ids: r.relatedRequirementIds ?? [],
    metadata: { catalog_title: r.title, seeded: true },
  }));

  const { data, error } = await sb
    .from('ai_act_compliance_assessments')
    .upsert(rows, {
      onConflict: 'tenant_id,asset_id,requirement_id',
      ignoreDuplicates: true,
    })
    .select('*');

  if (error) {
    return { ok: false, inserted: 0, skipped: 0, error: { code: 'SEED_FAILED', message: error.message } };
  }

  const inserted = (data ?? []).length;
  const skipped = catalog.length - inserted;

  // Re-fetch full set for the asset so callers get complete state.
  const listed = await listAiActComplianceAssessments(tenantId, assetId);
  return {
    ok: true,
    inserted,
    skipped,
    assessments: listed,
  };
}

export async function listAiActComplianceAssessments(
  tenantId: string,
  assetId?: string,
  article?: AiActComplianceArticle,
): Promise<AiActComplianceAssessment[]> {
  const sb = getSupabase();
  let q = sb
    .from('ai_act_compliance_assessments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('article', { ascending: true })
    .order('requirement_id', { ascending: true });

  if (assetId) q = q.eq('asset_id', assetId);
  if (article != null) q = q.eq('article', article);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbAiActComplianceAssessment[]).map(mapDbAiActComplianceAssessment);
}

export async function getAiActComplianceAssessment(
  id: string,
): Promise<AiActComplianceAssessment | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ai_act_compliance_assessments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapDbAiActComplianceAssessment(data as DbAiActComplianceAssessment);
}

export interface UpsertAssessmentInput {
  tenantId: string;
  assetId: string;
  requirementId: string;
  status?: AiActComplianceStatus;
  applicabilityReason?: string | null;
  evidenceIds?: string[];
  findingIds?: string[];
  policyId?: string | null;
  owner?: string | null;
  reviewer?: string | null;
  dueAt?: string | null;
  nextReviewAt?: string | null;
  remediation?: AiActRemediation | null;
  riskLevel?: AiActComplianceRiskLevel | null;
  relatedRequirementIds?: string[];
  classificationContext?: AiActClassificationContext | null;
  metadata?: Record<string, unknown>;
}

export async function upsertAiActComplianceAssessment(
  input: UpsertAssessmentInput,
): Promise<AiActComplianceAssessment> {
  const article = Number(input.requirementId.split('.')[0]);
  if (![9, 10, 11, 12, 13, 14, 15, 50].includes(article)) {
    throw new Error(`Invalid requirement_id: ${input.requirementId}`);
  }

  const catalog = AI_ACT_REQUIREMENT_CATALOG.find((r) => r.requirementId === input.requirementId);
  const sb = getSupabase();
  const now = new Date().toISOString();

  const remediationDb = input.remediation
    ? {
        summary: input.remediation.summary,
        steps: input.remediation.steps,
        owner: input.remediation.owner ?? null,
        due_at: input.remediation.dueAt ?? null,
        status: input.remediation.status,
      }
    : null;

  const classificationDb = input.classificationContext
    ? {
        high_risk: input.classificationContext.highRisk,
        basis: input.classificationContext.basis,
        annex_iii_area: input.classificationContext.annexIiiArea ?? null,
        rationale: input.classificationContext.rationale ?? null,
      }
    : null;

  const row = {
    tenant_id: input.tenantId,
    asset_id: input.assetId,
    regulation: 'EU_AI_ACT' as const,
    article,
    requirement_id: input.requirementId,
    status: input.status ?? 'open',
    applicability_reason: input.applicabilityReason ?? null,
    evidence_ids: input.evidenceIds ?? [],
    finding_ids: input.findingIds ?? [],
    policy_id: input.policyId ?? null,
    owner: input.owner ?? null,
    reviewer: input.reviewer ?? null,
    assessed_at: now,
    due_at: input.dueAt ?? null,
    next_review_at: input.nextReviewAt ?? null,
    remediation: remediationDb,
    risk_level: input.riskLevel ?? null,
    related_requirement_ids:
      input.relatedRequirementIds ?? catalog?.relatedRequirementIds ?? [],
    classification_context: classificationDb,
    metadata: input.metadata ?? (catalog ? { catalog_title: catalog.title } : {}),
  };

  const { data, error } = await sb
    .from('ai_act_compliance_assessments')
    .upsert(row, { onConflict: 'tenant_id,asset_id,requirement_id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapDbAiActComplianceAssessment(data as DbAiActComplianceAssessment);
}

export interface PatchAssessmentInput {
  status?: AiActComplianceStatus;
  applicabilityReason?: string | null;
  evidenceIds?: string[];
  findingIds?: string[];
  policyId?: string | null;
  owner?: string | null;
  reviewer?: string | null;
  dueAt?: string | null;
  nextReviewAt?: string | null;
  remediation?: AiActRemediation | null;
  riskLevel?: AiActComplianceRiskLevel | null;
  classificationContext?: AiActClassificationContext | null;
  metadata?: Record<string, unknown>;
}

export async function patchAiActComplianceAssessment(
  id: string,
  patch: PatchAssessmentInput,
): Promise<AiActComplianceAssessment> {
  const sb = getSupabase();
  const updates: Record<string, unknown> = {
    assessed_at: new Date().toISOString(),
  };

  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.applicabilityReason !== undefined) {
    updates.applicability_reason = patch.applicabilityReason;
  }
  if (patch.evidenceIds !== undefined) updates.evidence_ids = patch.evidenceIds;
  if (patch.findingIds !== undefined) updates.finding_ids = patch.findingIds;
  if (patch.policyId !== undefined) updates.policy_id = patch.policyId;
  if (patch.owner !== undefined) updates.owner = patch.owner;
  if (patch.reviewer !== undefined) updates.reviewer = patch.reviewer;
  if (patch.dueAt !== undefined) updates.due_at = patch.dueAt;
  if (patch.nextReviewAt !== undefined) updates.next_review_at = patch.nextReviewAt;
  if (patch.riskLevel !== undefined) updates.risk_level = patch.riskLevel;
  if (patch.metadata !== undefined) updates.metadata = patch.metadata;

  if (patch.remediation !== undefined) {
    updates.remediation = patch.remediation
      ? {
          summary: patch.remediation.summary,
          steps: patch.remediation.steps,
          owner: patch.remediation.owner ?? null,
          due_at: patch.remediation.dueAt ?? null,
          status: patch.remediation.status,
        }
      : null;
  }

  if (patch.classificationContext !== undefined) {
    updates.classification_context = patch.classificationContext
      ? {
          high_risk: patch.classificationContext.highRisk,
          basis: patch.classificationContext.basis,
          annex_iii_area: patch.classificationContext.annexIiiArea ?? null,
          rationale: patch.classificationContext.rationale ?? null,
        }
      : null;
  }

  const { data, error } = await sb
    .from('ai_act_compliance_assessments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapDbAiActComplianceAssessment(data as DbAiActComplianceAssessment);
}

export type ArticleScorecard = Record<
  AiActComplianceArticle | 'total',
  {
    open: number;
    partial: number;
    satisfied: number;
    not_applicable: number;
    blocked: number;
    total: number;
  }
>;

function emptyBucket() {
  return { open: 0, partial: 0, satisfied: 0, not_applicable: 0, blocked: 0, total: 0 };
}

/** Rollup by article for dashboard scorecards. */
export function buildAiActScorecard(
  assessments: AiActComplianceAssessment[],
): ArticleScorecard {
  const articles: AiActComplianceArticle[] = [9, 10, 11, 12, 13, 14, 15, 50];
  const result = {
    total: emptyBucket(),
  } as ArticleScorecard;

  for (const a of articles) result[a] = emptyBucket();

  for (const row of assessments) {
    const bucket = result[row.article] ?? emptyBucket();
    bucket[row.status] += 1;
    bucket.total += 1;
    result[row.article] = bucket;

    result.total[row.status] += 1;
    result.total.total += 1;
  }

  return result;
}
