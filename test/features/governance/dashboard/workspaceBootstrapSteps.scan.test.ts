/**
 * Addendum P0-5 + Korrektur (25.09.2026): Scan-CTA ehrlich benennen
 * (tenant-audit prüft HTML/Header, kein DNS/DMARC). „Erneut“-Wortlaut nur,
 * wenn scan_runs Zeilen hat — Scanner-/Seed-Events zählen nicht.
 */
import { describe, expect, it } from 'vitest';
import { computeWorkspaceBootstrapSteps } from '../../../../src/features/governance/dashboard/workspaceBootstrapSteps';
import { SCAN_STALE_DAYS, WEBSITE_AUDIT_CTA_LABEL } from '../../../../src/features/governance/dashboard/dashboardSignals';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();

describe('Nächste Schritte — Website-Audit', () => {
  it('Domain, keine scan_runs ⇒ ehrlicher Audit-CTA, kein „ersten Governance-Scan“', () => {
    const steps = computeWorkspaceBootstrapSteps({
      websiteCount: 2, scanCount: 0, activationStatus: 'activated', lastScanRunAt: null, now: NOW,
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].id).toBe('start-audit');
    expect(steps[0].title).toBe(WEBSITE_AUDIT_CTA_LABEL);
    expect(steps[0].title).toBe('Website-Audit (HTML/Header) starten');
    expect(steps[0].detail).toMatch(/keine DNS-\/DMARC-Prüfung/);
    expect(`${steps[0].title} ${steps[0].detail}`).not.toMatch(/Governance-Scan|Neuen Scan/);
  });

  it(`scan_runs vorhanden und älter als ${SCAN_STALE_DAYS} Tage ⇒ erneuter Audit mit Alter`, () => {
    const steps = computeWorkspaceBootstrapSteps({
      websiteCount: 2, scanCount: 1, activationStatus: 'activated', lastScanRunAt: iso(45), now: NOW,
    });
    expect(steps.map((s) => s.id)).toEqual(['rescan-audit']);
    expect(steps[0].title).toBe('Website-Audit erneut starten (letzter Audit vor 45 Tagen)');
  });

  it('frischer scan_run ⇒ kein Audit-Schritt', () => {
    const steps = computeWorkspaceBootstrapSteps({
      websiteCount: 2, scanCount: 1, activationStatus: 'activated', lastScanRunAt: iso(3), now: NOW,
    });
    expect(steps).toEqual([]);
  });

  it('scan_runs unbekannt (Ladefehler) ⇒ keine erfundene Dringlichkeit', () => {
    const steps = computeWorkspaceBootstrapSteps({
      websiteCount: 2, scanCount: null, activationStatus: 'activated', lastScanRunAt: null, now: NOW,
    });
    expect(steps).toEqual([]);
  });
});
