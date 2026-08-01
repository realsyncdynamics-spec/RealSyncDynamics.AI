// Scoring: Befunde → Kennzahlen.
//
// Die fünf Live-Scores des Monitorings entstehen ausschließlich aus
// `RuntimeFinding[]`. Das ist Absicht: jede Kennzahl ist damit auf einzelne,
// benannte Befunde zurückführbar und in einem Audit erklärbar. Es gibt keine
// verdeckten Eingaben und keine Zufallsanteile.
//
// Rechenweg:
//   1. Jede Dimension startet bei 100 und verliert je Befund Punkte
//      entsprechend seiner Schwere (DIMENSION_PENALTY).
//   2. Aggregate entstehen als gewichtete Mittel der Dimensionen.
//   3. Risiko-Kennzahlen sind die Inverse — höher heißt schlechter.
//
// Gewichte und Abzüge sind hier zentral hinterlegt, weil sie in
// Kundenberichten zitiert werden; Änderungen sind versionsrelevant.

import type { Dimension, RuntimeFinding, ScoreBreakdown, ScoreSet, Severity } from '../types.ts';

/** Punktabzug je Befund und Schwere. */
export const DIMENSION_PENALTY: Readonly<Record<Severity, number>> = Object.freeze({
  critical: 40,
  high: 20,
  medium: 8,
  low: 3,
  info: 1,
});

/** Gewichte des Gesamtindex. Summe = 1. */
export const HEALTH_WEIGHTS: Readonly<Record<Dimension, number>> = Object.freeze({
  gdpr: 0.20,
  security: 0.18,
  accessibility: 0.15,
  tdddg: 0.12,
  performance: 0.12,
  'eu-ai-act': 0.10,
  seo: 0.08,
  content: 0.05,
});

/** Gewichte des Compliance-Score (nur die regulatorischen Dimensionen). */
export const COMPLIANCE_WEIGHTS: Readonly<Partial<Record<Dimension, number>>> = Object.freeze({
  gdpr: 0.45,
  tdddg: 0.30,
  'eu-ai-act': 0.25,
});

/**
 * Aufschlag auf den Risiko-Score, wenn mindestens ein kritischer Befund
 * vorliegt. Ohne ihn kann ein einzelner kritischer Verstoß in einer sonst
 * sauberen Site im Mittel untergehen — genau der Fall, den das Risikomaß
 * sichtbar machen soll.
 */
export const CRITICAL_RISK_SURCHARGE = 10;

const ALL_DIMENSIONS = Object.keys(HEALTH_WEIGHTS) as Dimension[];

const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
});

/** Teilscore je Dimension, 0–100. Dimensionen ohne Befund bleiben bei 100. */
export function computeDimensionScores(findings: RuntimeFinding[]): Record<Dimension, number> {
  const scores = {} as Record<Dimension, number>;
  for (const dimension of ALL_DIMENSIONS) scores[dimension] = 100;

  for (const finding of findings) {
    // Unbekannte Dimensionen werden ignoriert statt zu werfen: ein neuer
    // Analysator darf ein bestehendes Monitoring nicht zum Absturz bringen.
    if (!(finding.dimension in scores)) continue;
    scores[finding.dimension] -= DIMENSION_PENALTY[finding.severity] ?? 0;
  }

  for (const dimension of ALL_DIMENSIONS) scores[dimension] = clamp(scores[dimension]);
  return scores;
}

export function computeScores(findings: RuntimeFinding[]): ScoreBreakdown {
  const dimensions = computeDimensionScores(findings);

  const health = weightedMean(dimensions, HEALTH_WEIGHTS);
  const compliance = weightedMean(dimensions, COMPLIANCE_WEIGHTS);
  const performance = dimensions.performance;

  const severityMax = maxSeverity(findings);
  const surcharge = severityMax === 'critical' ? CRITICAL_RISK_SURCHARGE : 0;
  const risk = clamp(100 - health + surcharge);

  // KI-Risiko speist sich aus den Transparenzpflichten und der
  // redaktionellen Reife generierter Inhalte — ein unfertiger generierter
  // Text ist ein KI-Risiko, kein Content-Schönheitsfehler.
  const aiRisk = clamp(0.75 * (100 - dimensions['eu-ai-act']) + 0.25 * (100 - dimensions.content));

  return {
    health: round(health),
    risk: round(risk),
    compliance: round(compliance),
    performance: round(performance),
    aiRisk: round(aiRisk),
    dimensions,
    findingCount: findings.length,
    severityMax,
  };
}

/** Höchste vorkommende Schwere; `null` bei befundfreier Analyse. */
export function maxSeverity(findings: RuntimeFinding[]): Severity | null {
  let best: Severity | null = null;
  for (const finding of findings) {
    if (best === null || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[best]) best = finding.severity;
  }
  return best;
}

/**
 * Darf die Site mit diesem Befundbild ausgeliefert werden? Der
 * Compliance-Agent nutzt das als Deployment-Gate: ein kritischer Befund
 * blockiert, alles andere wird als Auflage geführt.
 */
export function isDeployable(scores: ScoreSet & { severityMax?: Severity | null }): boolean {
  if (scores.severityMax === 'critical') return false;
  return scores.compliance >= 70;
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────

function weightedMean(
  scores: Record<Dimension, number>,
  weights: Readonly<Partial<Record<Dimension, number>>>,
): number {
  let total = 0;
  let weightSum = 0;
  for (const [dimension, weight] of Object.entries(weights) as [Dimension, number][]) {
    total += scores[dimension] * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 100 : total / weightSum;
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
