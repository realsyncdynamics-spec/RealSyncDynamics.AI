/**
 * Asset Lifecycle — TypeScript-Spiegel der serverseitigen Ableitung.
 *
 * Vertrag: docs/architecture/asset-lifecycle-contract.md §6.
 * SQL-Original: supabase/migrations/20260823000000_b3_asset_monitoring_lifecycle.sql
 *               (`public.asset_lifecycle_state`).
 *
 * **Die Datenbank ist die Wahrheit.** Diese Datei ist die Referenz für
 * Producer-Code und für Tests — sie darf den Zustand nicht selbst bestimmen,
 * wo die Datenbank ihn liefern kann. Laufen beide Seiten auseinander, verhält
 * sich die Anwendung anders als der Prüfpfad; `test/governance/
 * asset-lifecycle-parity.test.ts` bricht dann.
 *
 * Sicherheitsrelevanz: Der Zustand entscheidet, ob einem Mandanten
 * „Continuous Monitoring" angezeigt werden darf. Ein zu optimistischer Zustand
 * behauptet eine Überwachung, die nicht stattfindet — das ist im Zweifel ein
 * Compliance-Nachweis, der nicht trägt (EU AI Act Art. 72, laufende
 * Nachmarktbeobachtung; DSGVO Art. 5 Abs. 2, Rechenschaftspflicht).
 */

/** Zustände in aufsteigender Reife. `UNKNOWN` ist kein Rang, sondern Fail-closed. */
export type AssetLifecycleState =
  | 'UNKNOWN'
  | 'ANONYMOUS_BASELINE'
  | 'ASSET_CREATED'
  | 'BASELINE_VERIFIED'
  | 'EVIDENCE_CREATED'
  | 'MONITORING_ACTIVE'
  | 'CONTINUOUSLY_OBSERVED';

/** Eingaben der Ableitung. Alle Zählungen meinen bereits gefilterte Mengen. */
export interface AssetLifecycleInputs {
  /** Existiert ein persistiertes Asset? Ohne Asset gibt es keinen Zustand. */
  assetExists: boolean;
  /** Nur `status = 'completed'`. Fehlgeschlagene Runs zählen nicht (§4/§6). */
  completedRuns: number;
  findingsCount: number;
  evidenceCount: number;
  /** Aktive Monitoring-Beziehung nach §5 — nicht aus einem Datum geraten. */
  monitoringActive: boolean;
}

/**
 * Schwellen, die auch in der Migrations-SQL stehen. Nie einseitig ändern.
 */
export const LIFECYCLE_THRESHOLDS = {
  /** Ab so vielen abgeschlossenen Runs gilt eine Baseline als verifiziert. */
  baselineVerifiedRuns: 1,
  /** Ab so vielen abgeschlossenen Runs *und* aktivem Monitoring: fortlaufend. */
  continuouslyObservedRuns: 2,
  /** Ab so vielen Nachweisen am Asset gilt Evidence als erzeugt. */
  evidenceCreatedCount: 1,
} as const;

/**
 * Leitet den Zustand ab. Reihenfolge und Schwellen entsprechen dem CASE in
 * `asset_lifecycle_state` — die Prüfungen laufen absteigend, der erste Treffer
 * gewinnt.
 *
 * `findingsCount` geht bewusst **nicht** in den Zustand ein: Ein Asset ohne
 * Befunde ist nicht weniger beobachtet als eines mit Befunden. Der Wert wird
 * mitgeführt, weil die Oberfläche begründen können muss, warum ein Zustand
 * gilt — nicht, weil er ihn bestimmt.
 */
export function deriveAssetLifecycleState(input: AssetLifecycleInputs): AssetLifecycleState {
  if (!input.assetExists) return 'UNKNOWN';

  const t = LIFECYCLE_THRESHOLDS;
  if (input.monitoringActive && input.completedRuns >= t.continuouslyObservedRuns) {
    return 'CONTINUOUSLY_OBSERVED';
  }
  if (input.monitoringActive) return 'MONITORING_ACTIVE';
  if (input.evidenceCount >= t.evidenceCreatedCount) return 'EVIDENCE_CREATED';
  if (input.completedRuns >= t.baselineVerifiedRuns) return 'BASELINE_VERIFIED';
  return 'ASSET_CREATED';
}

/**
 * Darf für diesen Zustand „Continuous Monitoring" angezeigt werden?
 *
 * Die harte Phase-B-Festlegung (Contract §6) in einer Zeile: Nur der Zustand,
 * der eine aktive Monitoring-Beziehung *und* wiederholte Beobachtung belegt,
 * rechtfertigt die Aussage. `MONITORING_ACTIVE` allein bedeutet, dass ein
 * Zeitplan existiert — nicht, dass er je gelaufen ist.
 */
export function mayClaimContinuousMonitoring(state: AssetLifecycleState): boolean {
  return state === 'CONTINUOUSLY_OBSERVED';
}

/** Deutsche Beschriftungen. Ableitung und Darstellung bleiben getrennt (§10). */
export const LIFECYCLE_LABELS: Record<AssetLifecycleState, string> = {
  UNKNOWN:               'Nicht belegbar',
  ANONYMOUS_BASELINE:    'Anonyme Erstprüfung',
  ASSET_CREATED:         'Erfasst',
  BASELINE_VERIFIED:     'Baseline geprüft',
  EVIDENCE_CREATED:      'Nachweis erzeugt',
  MONITORING_ACTIVE:     'Zeitplan aktiv',
  CONTINUOUSLY_OBSERVED: 'Fortlaufend beobachtet',
};
