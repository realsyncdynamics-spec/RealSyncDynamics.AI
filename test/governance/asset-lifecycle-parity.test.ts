/**
 * B3 — Parität zwischen TypeScript-Spiegel und SQL-Ableitung.
 *
 * Der Lebenszyklus-Zustand existiert zweimal: als reine TS-Funktion
 * (src/core/governance/asset-lifecycle.ts) und als CASE in
 * `public.asset_lifecycle_state`. Läuft eine Seite weg, zeigt die Oberfläche
 * einen anderen Zustand als der Prüfpfad belegt.
 *
 * Diese Tests lesen die Migrations-SQL und vergleichen sie gegen die
 * TS-Konstanten. Sie brauchen keine Datenbank.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LIFECYCLE_THRESHOLDS,
  deriveAssetLifecycleState,
  mayClaimContinuousMonitoring,
  type AssetLifecycleState,
} from '@/src/core/governance/asset-lifecycle';

const migrationSql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20260823000000_b3_asset_monitoring_lifecycle.sql'),
  'utf8',
);

/** Nur die ausführbaren Zeilen — Kommentare dürfen nennen, was der Code meidet. */
const executableSql = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('B3 / SQL-Parität — Schwellen', () => {
  it('CONTINUOUSLY_OBSERVED verlangt Monitoring UND >= 2 Runs', () => {
    expect(migrationSql).toMatch(
      new RegExp(
        `v_monitoring AND v_runs >= ${LIFECYCLE_THRESHOLDS.continuouslyObservedRuns}\\s+THEN 'CONTINUOUSLY_OBSERVED'`,
      ),
    );
  });

  it('BASELINE_VERIFIED verlangt >= 1 abgeschlossenen Run', () => {
    expect(migrationSql).toMatch(
      new RegExp(
        `v_runs\\s+>= ${LIFECYCLE_THRESHOLDS.baselineVerifiedRuns}\\s+THEN 'BASELINE_VERIFIED'`,
      ),
    );
  });

  it('EVIDENCE_CREATED verlangt >= 1 Nachweis', () => {
    expect(migrationSql).toMatch(
      new RegExp(
        `v_evidence\\s+>= ${LIFECYCLE_THRESHOLDS.evidenceCreatedCount}\\s+THEN 'EVIDENCE_CREATED'`,
      ),
    );
  });

  it('nur abgeschlossene Runs zählen — ein fehlgeschlagener schreibt nichts fort', () => {
    expect(migrationSql).toMatch(/sr\.status = 'completed'/);
  });

  it('Monitoring wird aus der Relation abgeleitet, nicht aus einem Datum', () => {
    expect(migrationSql).toMatch(/FROM public\.scan_schedule_assets ssa/);
    expect(migrationSql).toMatch(/s\.enabled = TRUE/);
    expect(migrationSql).toMatch(/s\.paused\s+= FALSE/);
    expect(migrationSql).toMatch(/s\.next_run_at IS NOT NULL/);
    // Der ausdrücklich verbotene Ersatz (Contract §5): „Kein Flag am Asset.
    // Keine abgeleitete Vermutung aus next_reaudit_at."
    expect(executableSql).not.toMatch(/next_reaudit_at/);
  });

  it('die CASE-Reihenfolge entspricht der TS-Reihenfolge', () => {
    const order = ['CONTINUOUSLY_OBSERVED', 'MONITORING_ACTIVE', 'EVIDENCE_CREATED', 'BASELINE_VERIFIED', 'ASSET_CREATED'];
    const positions = order.map((s) => migrationSql.indexOf(`THEN '${s}'`) >= 0
      ? migrationSql.indexOf(`THEN '${s}'`)
      : migrationSql.indexOf(`'${s}'\n`));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i], `${order[i]} muss nach ${order[i - 1]} geprüft werden`)
        .toBeGreaterThan(positions[i - 1]);
    }
  });

  it('unsichtbares Asset liefert UNKNOWN, nicht einen Fehler oder Restwert', () => {
    expect(migrationSql).toMatch(/'UNKNOWN'::TEXT, 0, 0, 0, FALSE/);
  });

  it('Mandantenprüfung steht im Rumpf, weil SECURITY DEFINER RLS umgeht', () => {
    expect(migrationSql).toMatch(/SECURITY DEFINER/);
    expect(migrationSql).toMatch(/public\.is_tenant_member\(v_tenant\)/);
    expect(migrationSql).toMatch(/SET search_path = public, pg_temp/);
  });
});

describe('B3 / Ableitung — dieselben Fälle wie der DB-Lauf', () => {
  const base = {
    assetExists: true,
    completedRuns: 0,
    findingsCount: 0,
    evidenceCount: 0,
    monitoringActive: false,
  };

  const cases: Array<[string, Partial<typeof base>, AssetLifecycleState]> = [
    ['frisches Asset',                        {},                                                   'ASSET_CREATED'],
    ['nur fehlgeschlagene Runs',              { completedRuns: 0 },                                 'ASSET_CREATED'],
    ['ein abgeschlossener Run',               { completedRuns: 1 },                                 'BASELINE_VERIFIED'],
    ['Nachweis vorhanden',                    { completedRuns: 1, evidenceCount: 1 },               'EVIDENCE_CREATED'],
    ['pausierter Zeitplan',                   { completedRuns: 1, evidenceCount: 1, monitoringActive: false }, 'EVIDENCE_CREATED'],
    ['aktiver Zeitplan, ein Run',             { completedRuns: 1, monitoringActive: true },         'MONITORING_ACTIVE'],
    ['aktiver Zeitplan, zwei Runs',           { completedRuns: 2, monitoringActive: true },         'CONTINUOUSLY_OBSERVED'],
    ['kein Asset',                            { assetExists: false, completedRuns: 9, monitoringActive: true }, 'UNKNOWN'],
  ];

  it.each(cases)('%s → %s', (_label, patch, expected) => {
    expect(deriveAssetLifecycleState({ ...base, ...patch })).toBe(expected);
  });

  it('Befunde verschieben den Zustand nicht', () => {
    expect(deriveAssetLifecycleState({ ...base, completedRuns: 1, findingsCount: 99 }))
      .toBe('BASELINE_VERIFIED');
  });
});

describe('B3 / Die harte Regel', () => {
  it('nur CONTINUOUSLY_OBSERVED rechtfertigt „Continuous Monitoring"', () => {
    const states: AssetLifecycleState[] = [
      'UNKNOWN', 'ANONYMOUS_BASELINE', 'ASSET_CREATED',
      'BASELINE_VERIFIED', 'EVIDENCE_CREATED', 'MONITORING_ACTIVE',
    ];
    for (const s of states) {
      expect(mayClaimContinuousMonitoring(s), `${s} darf es nicht behaupten`).toBe(false);
    }
    expect(mayClaimContinuousMonitoring('CONTINUOUSLY_OBSERVED')).toBe(true);
  });

  it('ohne Asset ist der Zustand nie eine Behauptung', () => {
    const state = deriveAssetLifecycleState({ ...{
      assetExists: false, completedRuns: 5, findingsCount: 3,
      evidenceCount: 4, monitoringActive: true,
    } });
    expect(state).toBe('UNKNOWN');
    expect(mayClaimContinuousMonitoring(state)).toBe(false);
  });
});
