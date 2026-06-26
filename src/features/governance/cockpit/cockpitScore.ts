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

// Penalty-Gewichte je offenem Posten — übernommen aus WorkspaceHome:352-361,
// damit Cockpit und Status-Home denselben Massstab verwenden.
export const PENALTY_WEIGHTS = {
  dsrOverdue: 12,
  incident: 10,
  dpia: 5,
  vendorNoDpa: 4,
  approval: 3,
} as const;

// Mischung: 60 % offene-Posten-Penalty, 40 % KPI-Posture (Policy-/Evidence-Abdeckung).
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
 * Gesamt-Governance-Score (0..100). Ohne Posture-Daten fällt er auf den
 * reinen Penalty-Score zurück (z. B. wenn noch kein KPI-Snapshot existiert).
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
 * Audit-Readiness in Prozent. v1-Proxy = Anteil der Assets mit
 * Control-Mapping (assets_with_mappings_percent). Ohne Snapshot → null.
 */
export function computeAuditReadiness(posture?: CockpitPosture | null): number | null {
  if (!posture) return null;
  return Math.round(clamp(posture.assetMappingsPercent));
}

/** Ampel-Stufe passend zu den ScoreGauge-Schwellen. */
export function scoreLevel(score: number): ScoreLevel {
  if (score >= 85) return 'passed';
  if (score >= 65) return 'low';
  if (score >= 40) return 'medium';
  return 'critical';
}

/** CEO-taugliches Label (deutsch). */
export function scoreLabel(score: number): string {
  if (score >= 90) return 'Sehr gut';
  if (score >= 75) return 'Gut';
  if (score >= 50) return 'Verbesserungsbedarf';
  return 'Handlungsbedarf';
}
