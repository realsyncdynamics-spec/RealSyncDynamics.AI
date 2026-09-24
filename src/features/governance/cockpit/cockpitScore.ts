// CEO-Cockpit — reine Score-/Readiness-Ableitung (v1, transparent, testbar).
//
// Keine Netzwerk-Aufrufe, keine React-Abhängigkeit: ausschliesslich Ableitung
// aus bereits vorhandenen, RLS-gescopten Kennzahlen (Count-Helfer +
// governance_kpi_snapshots). Bewusst KEINE Zertifizierungs-Behauptung —
// der Score ist ein Self-Assessment für die Geschäftsführung.

export type ScoreLevel = 'critical' | 'high' | 'medium' | 'low' | 'passed';

/** Offene Posten — identische Struktur wie in WorkspaceHome (RLS-Count-Helfer). */
export interface CockpitCounts {
  incidents: number;
  dpias: number;
  dsr: { total: number; overdue: number };
  approvals: number;
  vendorsNoDpa: number;
}

/** Posture-Anteil aus dem täglichen KPI-Snapshot (governance_kpi_snapshots). */
export interface CockpitPosture {
  policiesEnabledPercent: number;
  assetEvidencePercent: number;
  assetMappingsPercent: number;
}

export const PENALTY_WEIGHTS = {
  dsrOverdue: 12,
  incident: 10,
  dpia: 5,
  vendorNoDpa: 4,
  approval: 3,
} as const;

export const SCORE_BLEND = { penalty: 0.6, posture: 0.4 } as const;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Reiner Penalty-Score (0..100) nur aus offenen Posten. */
export function computePenaltyScore(counts: CockpitCounts): number {
  const penalty =
    counts.dsr.overdue * PENALTY_WEIGHTS.dsrOverdue +
    counts.incidents * PENALTY_WEIGHTS.incident +
    counts.dpias * PENALTY_WEIGHTS.dpia +
    counts.vendorsNoDpa * PENALTY_WEIGHTS.vendorNoDpa +
    counts.approvals * PENALTY_WEIGHTS.approval;
  return clamp(100 - penalty);
}

/**
 * Gesamt-Governance-Score (0..100) wenn Counts + Posture vorliegen.
 * Ohne Snapshot nicht aufrufen — dafür computeGovernanceScoreIfReliable.
 */
export function computeGovernanceScore(
  counts: CockpitCounts,
  posture?: CockpitPosture | null,
): number {
  const penaltyScore = computePenaltyScore(counts);
  if (!posture) return Math.round(penaltyScore);
  const postureScore = clamp(
    (posture.policiesEnabledPercent + posture.assetEvidencePercent) / 2,
  );
  return Math.round(
    SCORE_BLEND.penalty * penaltyScore + SCORE_BLEND.posture * postureScore,
  );
}

/**
 * Anzeigbarer Score. Ohne zuverlässige Counts oder ohne KPI-Snapshot: null.
 * Leere Zähler ohne Snapshot dürfen nicht als 100 / „Sehr gut“ erscheinen.
 */
export function computeGovernanceScoreIfReliable(
  countsReliable: boolean,
  counts: CockpitCounts,
  posture?: CockpitPosture | null,
): number | null {
  if (!countsReliable) return null;
  if (!posture) return null;
  return computeGovernanceScore(counts, posture);
}

export function computeAuditReadiness(posture?: CockpitPosture | null): number | null {
  if (!posture) return null;
  return Math.round(clamp(posture.assetMappingsPercent));
}

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 85) return 'passed';
  if (score >= 65) return 'low';
  if (score >= 40) return 'medium';
  return 'critical';
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Sehr gut';
  if (score >= 75) return 'Gut';
  if (score >= 50) return 'Verbesserungsbedarf';
  return 'Handlungsbedarf';
}
