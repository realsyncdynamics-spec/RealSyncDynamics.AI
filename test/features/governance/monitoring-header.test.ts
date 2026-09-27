/**
 * Gate 1 — Monitoring-Kopfzeile nur aus echten Mandantenquellen.
 * Früher: „Scans heute 142“, „Nächste Prüfung 07:45“, „AKTIV“ fest im Code,
 * bei Ladefehlern Ersatzwerte (18 Assets, 4 Alerts).
 */
import { describe, expect, it } from 'vitest';
import { buildMonitoringHeader, SCAN_WINDOW_LIMIT } from '../../../src/features/governance/monitoring/monitoringHeader';
import { EMPTY_SUMMARY_24H } from '../../../src/features/governance/dashboard/complianceStatus';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('buildMonitoringHeader', () => {
  it('alle Quellen fehlgeschlagen ⇒ überall „—“, Status unbekannt — keine Ersatzzahlen', () => {
    const header = buildMonitoringHeader({
      assets: null, openIncidents: null, scanRuns: null, summary: null, summaryFailed: true, now: NOW,
    });
    expect(header).toEqual({
      status: 'unknown', assets: '—', scans24h: '—', openIncidents: '—', lastScan: '—', nextScan: '—',
    });
  });

  it('leerer Mandant ⇒ echte Nullen, „Noch kein Scan“, keine aktive Quelle', () => {
    const header = buildMonitoringHeader({
      assets: 0, openIncidents: 0, scanRuns: [], summary: EMPTY_SUMMARY_24H, summaryFailed: false, now: NOW,
    });
    expect(header).toMatchObject({
      status: 'no_sources', assets: '0', scans24h: '0', openIncidents: '0', lastScan: 'Noch kein Scan', nextScan: 'Nicht geplant',
    });
  });

  it('zählt nur Scans der letzten 24 h und zeigt den jüngsten', () => {
    const header = buildMonitoringHeader({
      assets: 3,
      openIncidents: 1,
      scanRuns: [{ created_at: hoursAgo(2) }, { created_at: hoursAgo(5) }, { created_at: hoursAgo(30) }],
      summary: { ...EMPTY_SUMMARY_24H, active_sources: 2, next_scan_at: '2026-09-27T16:30:00Z' },
      summaryFailed: false,
      now: NOW,
    });
    expect(header.status).toBe('active');
    expect(header.scans24h).toBe('2');
    expect(header.lastScan).toBe('vor 2 Std.');
    expect(header.nextScan).toBe('18:30');
  });

  it('volles Ladefenster innerhalb 24 h ⇒ „n+“ statt einer zu kleinen Zahl', () => {
    const runs = Array.from({ length: SCAN_WINDOW_LIMIT }, () => ({ created_at: hoursAgo(1) }));
    const header = buildMonitoringHeader({
      assets: 1, openIncidents: 0, scanRuns: runs, summary: EMPTY_SUMMARY_24H, summaryFailed: false, now: NOW,
    });
    expect(header.scans24h).toBe(`${SCAN_WINDOW_LIMIT}+`);
  });

  it('kein 24h-Summary vorhanden ⇒ Status unbekannt statt „aktiv“', () => {
    const header = buildMonitoringHeader({
      assets: 1, openIncidents: 0, scanRuns: [], summary: null, summaryFailed: false, now: NOW,
    });
    expect(header.status).toBe('unknown');
    expect(header.nextScan).toBe('—');
  });
});

describe('MonitoringRuntimeView — keine festen Kennzahlen mehr', () => {
  it('Kopfzeile ohne „142“, „07:45“ und Ersatzwerte 18/4', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/features/governance/monitoring/MonitoringRuntimeView.tsx', 'utf8');
    expect(src).not.toContain('value="142"');
    expect(src).not.toContain('value="07:45"');
    expect(src).not.toContain("useState<string>('18')");
    expect(src).not.toContain("useState<string>('4')");
    expect(src).toContain('buildMonitoringHeader');
    expect(src).toContain('monitoring-preview-notice');
  });
});
