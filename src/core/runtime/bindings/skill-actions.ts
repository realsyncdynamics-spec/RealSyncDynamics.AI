// Action-Maps fuer jeden Skill. Jeder Eintrag wickelt eine pure Funktion
// aus `src/lib/skills/<key>.ts` so ein, dass sie aus dem Runtime-Handler
// per `ctx.args.action` aufrufbar ist.
//
// Bewusst KEINE neue Logik: die Skill-Implementierung lebt weiter in
// lib/skills. Der Bindings-Layer adaptiert nur Signaturen.

import type { SkillKey } from '../../../lib/skills/registry';
import type { ActionMap } from './dispatch';

import {
  classifyColumn,
  buildDataProfilingPlan,
} from '../../../lib/skills/dataExploration';
import {
  classifyDeficiency,
  recommendSampleSize,
} from '../../../lib/skills/financeAuditSupport';
import {
  buildDsarChecklist,
  buildDpaReviewChecklist,
} from '../../../lib/skills/legalCompliance';
import {
  classifyClauseDeviation,
  buildRedlineReviewPlan,
} from '../../../lib/skills/legalContractReview';
import {
  calculateConversionRate,
  calculateCtr,
  calculateRoas,
  prioritizeOptimization,
} from '../../../lib/skills/marketingPerformanceAnalytics';
import { buildCallPrepOutline } from '../../../lib/skills/salesCallPrep';
import { buildOutreachResearchPlan } from '../../../lib/skills/salesDraftOutreach';

function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`args.${key} must be non-empty string`);
  return v;
}
function requireNumber(args: Record<string, unknown>, key: string): number {
  const v = args[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`args.${key} must be finite number`);
  return v;
}
function requireArray(args: Record<string, unknown>, key: string): unknown[] {
  const v = args[key];
  if (!Array.isArray(v)) throw new Error(`args.${key} must be array`);
  return v;
}
function requireObject(args: Record<string, unknown>, key: string): Record<string, unknown> {
  const v = args[key];
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`args.${key} must be object`);
  }
  return v as Record<string, unknown>;
}

export const SKILL_ACTIONS: Record<SkillKey, ActionMap> = {
  'data-exploration': {
    classify_column: (args) =>
      classifyColumn(requireString(args, 'name'), requireArray(args, 'sample_values')),
    build_profiling_plan: (args) =>
      // The caller pre-classifies columns; we keep this skill purely structural.
      buildDataProfilingPlan(requireArray(args, 'columns') as never),
  },

  'finance-audit-support': {
    classify_deficiency: (args) =>
      classifyDeficiency(requireObject(args, 'input') as never),
    recommend_sample_size: (args) =>
      recommendSampleSize(
        requireString(args, 'control_frequency') as never,
        requireString(args, 'risk_level') as never,
      ),
  },

  'legal-compliance': {
    build_dsar_checklist: (args) => buildDsarChecklist(requireString(args, 'regulation')),
    build_dpa_review_checklist: () => buildDpaReviewChecklist(),
  },

  'legal-contract-review': {
    classify_clause_deviation: (args) =>
      classifyClauseDeviation(requireString(args, 'severity')),
    build_redline_review_plan: (args) =>
      buildRedlineReviewPlan(
        requireString(args, 'contract_type'),
        requireString(args, 'user_side'),
      ),
  },

  'marketing-performance-analytics': {
    calculate_conversion_rate: (args) =>
      calculateConversionRate(requireNumber(args, 'numerator'), requireNumber(args, 'denominator')),
    calculate_ctr: (args) =>
      calculateCtr(requireNumber(args, 'clicks'), requireNumber(args, 'impressions')),
    calculate_roas: (args) =>
      calculateRoas(requireNumber(args, 'revenue'), requireNumber(args, 'spend')),
    prioritize_optimization: (args) =>
      prioritizeOptimization(requireArray(args, 'items') as never),
  },

  'sales-call-prep': {
    build_call_prep_outline: (args) =>
      buildCallPrepOutline(requireString(args, 'company'), requireString(args, 'meeting_type')),
  },

  'sales-draft-outreach': {
    build_outreach_research_plan: (args) =>
      buildOutreachResearchPlan(requireObject(args, 'target') as never),
  },
};
