// FutureFishModel — pure scoring engine for future signals.
//
// "Hermes swims through data streams and recognises early signals
//  before they become mainstream."
//
// Six 0..1 dimensions feed a weighted aggregate
// `future_opportunity_score`. The weights are tuned to favour
// signals that COULD MONETISE soon (urgency + monetization +
// timing) over signals that are simply NOVEL but unactionable.

import type { SignalScores, SignalType } from './types';

/**
 * Weights for the six dimensions. Sum to 100 so the aggregate IS the
 * weighted mean across [0..1] dimension scores.
 */
export const DEFAULT_WEIGHTS: Record<keyof SignalScores, number> = {
  novelty_score:        15,
  urgency_score:        22,
  monetization_score:   22,
  defensibility_score:  13,
  timing_score:         18,
  evidence_score:       10,
};

/**
 * Compute the aggregate from the six dimensions. Pure function;
 * deterministic given the inputs. Clamped to [0, 1].
 */
export function scoreFutureSignal(
  scores: SignalScores,
  weights: Record<keyof SignalScores, number> = DEFAULT_WEIGHTS,
): number {
  const dims: Array<keyof SignalScores> = [
    'novelty_score', 'urgency_score', 'monetization_score',
    'defensibility_score', 'timing_score', 'evidence_score',
  ];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const d of dims) {
    const w = weights[d];
    const raw = clamp01(scores[d]);
    weightedSum += raw * w;
    totalWeight += w;
  }
  return round2(weightedSum / totalWeight);
}

// ── Heuristic helpers ──────────────────────────────────────────────
//
// These give a SignalScores back from common signal-shapes when the
// caller doesn't have explicit grading yet. Used by the
// HermesAgent.extractSignals() default path; real LLM-graded scoring
// can be swapped in via the score-fn override.

const NOVELTY_BOOST: Record<SignalType, number> = {
  weak: 0.85, rising: 0.65, regulatory: 0.55,
  competitor: 0.55, customer_pain: 0.60, technology: 0.70,
  funding: 0.50, platform_shift: 0.80,
};

const URGENCY_BOOST: Record<SignalType, number> = {
  weak: 0.30, rising: 0.55, regulatory: 0.80,
  competitor: 0.65, customer_pain: 0.70, technology: 0.45,
  funding: 0.50, platform_shift: 0.60,
};

const MONETIZATION_BOOST: Record<SignalType, number> = {
  weak: 0.40, rising: 0.65, regulatory: 0.70,
  competitor: 0.55, customer_pain: 0.80, technology: 0.55,
  funding: 0.45, platform_shift: 0.65,
};

const DEFENSIBILITY_BOOST: Record<SignalType, number> = {
  weak: 0.50, rising: 0.45, regulatory: 0.75,    // regulatory moats compound
  competitor: 0.40, customer_pain: 0.55, technology: 0.55,
  funding: 0.35, platform_shift: 0.50,
};

const TIMING_BOOST: Record<SignalType, number> = {
  weak: 0.50, rising: 0.70, regulatory: 0.65,
  competitor: 0.60, customer_pain: 0.75, technology: 0.55,
  funding: 0.50, platform_shift: 0.55,
};

/**
 * Heuristic scorer used when no explicit per-dimension grading is
 * supplied. Pulls a baseline from the signal_type, then nudges based
 * on a few content cues (presence of evidence, specific market areas,
 * time horizon).
 */
export function heuristicScore(args: {
  signal_type:  SignalType;
  evidence:     string[];
  description:  string;
  time_horizon: '3_months' | '6_months' | '12_months' | '24_months';
}): SignalScores {
  const { signal_type, evidence, description, time_horizon } = args;

  const evCount = evidence.length;
  const evScore = evCount === 0 ? 0.10
    : evCount === 1 ? 0.55
    : evCount === 2 ? 0.75
    : 0.90;

  // Closer horizons → more "actionable" → timing nudges up.
  const horizonNudge =
    time_horizon === '3_months'  ? 0.15 :
    time_horizon === '6_months'  ? 0.05 :
    time_horizon === '12_months' ? -0.05 : -0.15;

  // Detect monetisation-friendly vocabulary in the description.
  const monetisationCue = /\b(?:revenue|customer|paying|seat|enterprise|tier|pricing|adoption|spend)\b/i
    .test(description) ? 0.10 : 0.0;

  // Detect urgency vocabulary.
  const urgencyCue = /\b(?:deadline|compliance|enforcement|sanction|bu(?:ß|ss)geld|fine|breach|incident)\b/i
    .test(description) ? 0.10 : 0.0;

  return {
    novelty_score:        clamp01(NOVELTY_BOOST[signal_type]),
    urgency_score:        clamp01(URGENCY_BOOST[signal_type]      + urgencyCue),
    monetization_score:   clamp01(MONETIZATION_BOOST[signal_type] + monetisationCue),
    defensibility_score:  clamp01(DEFENSIBILITY_BOOST[signal_type]),
    timing_score:         clamp01(TIMING_BOOST[signal_type]       + horizonNudge),
    evidence_score:       clamp01(evScore),
  };
}

// ── Public helpers ─────────────────────────────────────────────────

/** Maps the aggregate to a coarse priority band, used by the
 *  daily-brief generator and the UI. */
export function opportunityBand(aggregate: number): 'top' | 'watch' | 'background' {
  if (aggregate >= 0.70) return 'top';
  if (aggregate >= 0.50) return 'watch';
  return 'background';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
