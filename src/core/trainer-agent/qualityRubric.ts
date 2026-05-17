// Quality rubric — pure scoring functions.
//
// Score every AgentOutput across 7 dimensions, produce a 0..100
// aggregate, and decide approve/block at the 80 threshold.

import type { AgentOutput, QualityScores } from './types';

/**
 * Weights for the 7 dimensions. Sum to 100 so the aggregate IS the
 * weighted mean across [0..100] dimension scores.
 *
 * Note: `risk_level` is INVERTED — the raw score is "how risky"
 * (0=safe, 100=catastrophic). The aggregator subtracts it from 100
 * before applying the weight. So a high raw `risk_level` reduces the
 * aggregate; a low raw `risk_level` raises it.
 */
export const DEFAULT_WEIGHTS: Record<keyof QualityScores, number> = {
  correctness:      22,
  completeness:     18,
  evidence_quality: 18,
  clarity:          10,
  actionability:    10,
  risk_level:       12,   // inverted in aggregateScore()
  confidence:       10,
};

export const APPROVE_THRESHOLD = 80;

// ── Public surface ────────────────────────────────────────────────

/**
 * Score a single AgentOutput. The heuristics here are intentionally
 * SIMPLE — they're a default; real LLM-graded scoring lives in a
 * follow-up that pipes the output through ai-gateway. This default
 * implementation lets the trainer run end-to-end in tests and on
 * outputs that don't yet have an LLM-grader hook.
 */
export function defaultScoreOutput(output: AgentOutput): QualityScores {
  const c = output.content;
  const text = typeof c === 'string' ? c : JSON.stringify(c ?? '');
  const len = text.length;

  // correctness — proxy: presence of non-empty content + agent's own
  // confidence (clamped to [40, 95] for the prior).
  const selfConf = typeof output.self_confidence === 'number'
    ? Math.max(0, Math.min(100, output.self_confidence))
    : 70;
  const correctness = len === 0 ? 0 : Math.round((selfConf + 80) / 2);

  // completeness — proxy: text long enough to be useful (>= 80 chars
  // = 100; linear ramp below).
  const completeness = Math.round(Math.min(100, (len / 80) * 100));

  // evidence_quality — proxy: explicit evidence array. None = 0; 1 = 60;
  // 2 = 80; 3+ = 95.
  const evCount = (output.evidence ?? []).length;
  const evidence_quality = evCount === 0 ? 0
    : evCount === 1 ? 60
    : evCount === 2 ? 80
    : 95;

  // clarity — proxy: not too dense (avg word len < 12 = OK).
  const words = text.split(/\s+/).filter(Boolean);
  const avgWord = words.length ? text.length / words.length : 0;
  const clarity = avgWord === 0 ? 0
    : avgWord > 14 ? 50
    : avgWord > 10 ? 70
    : 90;

  // actionability — proxy: presence of imperative verbs / numbered
  // steps / decision words.
  const actionable = /\b(?:do|run|check|verify|configure|enable|disable|set|remove|add|fix|review|approve|reject|notify|escalate)\b/i.test(text)
    || /^\s*[-*•\d]/m.test(text);
  const actionability = actionable ? 85 : 50;

  // risk_level — proxy: high if mentions of "fine", "violation",
  // "legal", "deploy", "production" and no evidence to back it.
  const risky = /\b(?:bu(?:ß|ss)geld|fine|fines|violation|verletzung|strafbar|deploy|production|breach)\b/i.test(text);
  const risk_level = risky && evCount === 0 ? 80
    : risky ? 40
    : 15;

  // confidence — use self-confidence with a small penalty if evidence
  // is empty.
  const confidence = Math.max(0, selfConf - (evCount === 0 ? 15 : 0));

  return { correctness, completeness, evidence_quality, clarity, actionability, risk_level, confidence };
}

/**
 * Aggregate dimension scores into a single 0..100 number. `risk_level`
 * is inverted (lower raw = higher contribution). The result is rounded
 * to an integer.
 */
export function aggregateScore(
  scores: QualityScores,
  weights: Record<keyof QualityScores, number> = DEFAULT_WEIGHTS,
): number {
  const dims: Array<keyof QualityScores> = [
    'correctness', 'completeness', 'evidence_quality',
    'clarity', 'actionability', 'risk_level', 'confidence',
  ];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const d of dims) {
    const w = weights[d];
    const raw = clamp(scores[d], 0, 100);
    const effective = d === 'risk_level' ? 100 - raw : raw;
    weightedSum += effective * w;
    totalWeight += w;
  }
  return Math.round(weightedSum / totalWeight);
}

/**
 * Produce the human-readable issues list for a score breakdown. Used
 * by TrainerAgent.reviewOutput() to surface WHY a score landed where
 * it did.
 */
export function explainIssues(scores: QualityScores): string[] {
  const issues: string[] = [];
  if (scores.correctness < 70)      issues.push('correctness score below threshold — content may be wrong or empty');
  if (scores.completeness < 50)     issues.push('output appears truncated or sparse');
  if (scores.evidence_quality < 60) issues.push('insufficient evidence / sources backing the output');
  if (scores.clarity < 70)          issues.push('unclear language — long sentences or jargon-dense prose');
  if (scores.actionability < 60)    issues.push('output lacks concrete next steps or decision points');
  if (scores.risk_level > 60)       issues.push('elevated risk vocabulary without supporting evidence');
  if (scores.confidence < 60)       issues.push('agent confidence is low — consider peer-help before approval');
  return issues;
}

/** Decide if an aggregate score crosses the approve threshold. */
export function shouldApprove(aggregate: number, threshold = APPROVE_THRESHOLD): boolean {
  return aggregate >= threshold;
}

/** Map an aggregate score to a coarse risk band for UI surfacing. */
export function riskBand(aggregate: number): 'green' | 'yellow' | 'red' {
  if (aggregate >= 80) return 'green';
  if (aggregate >= 60) return 'yellow';
  return 'red';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
