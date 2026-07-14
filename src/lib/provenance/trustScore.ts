/**
 * Provenance — Trust-Score-Berechnung.
 *
 * Wandelt die harten Evidenz-Signale eines Assets (Signatur gültig?
 * Custody intakt? Metadaten konsistent?) in einen 0–100-Trust-Score plus
 * Risiko-Labels um. Ersetzt den bisherigen Mock (`c2pa: true`-Flag) durch
 * eine deterministische, nachvollziehbare Formel.
 *
 * Pure, deterministisch, KEINE Side-Effects. `evaluatedAt` wird übergeben
 * (kein Date.now()), damit TS- und SQL-/Edge-Ergebnisse vergleichbar bleiben.
 */

import type { TrustOutput } from '../../types/models';
import type { TamperEvidenceState } from './custody';

export interface TrustScoreInput {
  assetId: string;
  /** Ergebnis der kryptografischen Signaturprüfung des jüngsten Manifests. */
  signatureValid: boolean;
  /** Zustand der Chain-of-Custody (aus verifyCustodyChain). */
  custodyState: TamperEvidenceState;
  /** Stimmen die deklarierten Metadaten mit dem Inhalts-Hash überein? */
  metadataIntegrity: boolean;
  /** Ist der Eigentümer/Herausgeber über die Kette konsistent? */
  ownershipConsistency: boolean;
  /** Optional: offener Policy-Konflikt (z.B. Lizenz-/Revocation-Treffer). */
  policyConflict?: boolean;
  /** ISO-8601-UTC-Zeitpunkt der Bewertung. */
  evaluatedAt: string;
}

// Punktabzüge pro fehlendem Signal (Summe der Maxima = 100).
const PENALTY = {
  signatureInvalid: 40,
  custodyTampered: 30,
  custodyUnverifiable: 20,
  metadata: 15,
  ownership: 15,
  policy: 20,
} as const;

/**
 * Berechnet den TrustOutput deterministisch aus den Evidenz-Signalen.
 * Score wird auf [0, 100] geklemmt; Eskalation ab < 50 oder bei
 * disputed_ownership / manipulierter Kette.
 */
export function computeTrustOutput(input: TrustScoreInput): TrustOutput {
  const riskLabels: TrustOutput['riskLabels'] = [];
  let score = 100;

  if (!input.signatureValid) {
    score -= PENALTY.signatureInvalid;
    riskLabels.push('signature_gap');
  }

  if (input.custodyState === 'tampered') {
    score -= PENALTY.custodyTampered;
    if (!riskLabels.includes('signature_gap')) riskLabels.push('signature_gap');
  } else if (input.custodyState === 'unverifiable') {
    score -= PENALTY.custodyUnverifiable;
    riskLabels.push('unverifiable_source');
  }

  if (!input.metadataIntegrity) {
    score -= PENALTY.metadata;
    if (!riskLabels.includes('unverifiable_source')) riskLabels.push('unverifiable_source');
  }

  if (!input.ownershipConsistency) {
    score -= PENALTY.ownership;
    riskLabels.push('disputed_ownership');
  }

  if (input.policyConflict) {
    score -= PENALTY.policy;
    riskLabels.push('policy_conflict');
  }

  const trustScore = clamp(score, 0, 100);

  const provenanceContinuity = input.custodyState === 'intact';
  const escalationTriggered =
    trustScore < 50 ||
    input.custodyState === 'tampered' ||
    riskLabels.includes('disputed_ownership');

  return {
    assetId: input.assetId,
    trustScore,
    riskLabels: dedupe(riskLabels),
    evidenceComponents: {
      metadataIntegrity: input.metadataIntegrity,
      ownershipConsistency: input.ownershipConsistency,
      provenanceContinuity,
    },
    escalationTriggered,
    evaluatedAt: input.evaluatedAt,
  };
}

/** Grobes Label für die UI (Trust-Score-Badge). */
export function trustBand(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
