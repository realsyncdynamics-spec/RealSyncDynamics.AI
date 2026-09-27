/**
 * Gate 1 — Monitoring-Kopfzeile nur aus echten Mandantenquellen.
 * Früher: „Scans heute 142“, „Nächste Prüfung 07:45“, „AKTIV“ fest im Code,
 * bei Ladefehlern Ersatzwerte (18 Assets, 4 Alerts).
 *
 * Quelle ist `monitoring_sources` (dort schreibt der Scheduler last_scan_at /
 * next_scan_at), nicht `scan_runs` allein — sonst stünde bei aktivem
 * Monitoring „AKTIV“ neben „Noch kein Scan“.
 */
import { describe, expect, it } from 'vitest';
import { buildMonitoringHeader } from '../../../src/features/governance/monitoring/monitoringHeader';

const NOW = Date.parse('2026-09-27T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

describe('buildMonitoringHeader', () => {
  it('alle Quellen fehlgeschlagen ⇒ überall „—“, Status unbekannt — keine Ersatzzahlen', () => {
    const header = buildMonitoringHeader({ sources: null, openIncidents: null, latestAuditRuns: null, now: NOW });
    expect(header).toEqual({
      status: 'unknown', sources: '—', failingSources: '—', openIncidents: '—', lastScan: '—', nextScan: '—',
    });
  });

  it('leerer Mandant ⇒ echte Nullen, „Noch kein Scan“, keine aktive Quelle', () => {
    const header = buildMonitoringHeader({ sources: [], openIncidents: 0, latestAuditRuns: [], now: NOW });
    expect(header).toEqual({
      status: 'no_sources', sources: '0/0', failingSources: '0', openIncidents: '0',
      lastScan: 'Noch kein Scan', nextScan: 'Keine aktive Quelle',
    });
  });

  it('Scheduler-Scan in monitoring_sources zählt als letzter Scan — auch ohne scan_runs', () => {
    const header = buildMonitoringHeader({
      sources: [
        { status: 'active', last_scan_at: hoursAgo(2), next_scan_at: inHours(4.5) },
        { status: 'active', last_scan_at: hoursAgo(5), next_scan_at: inHours(8) },
        { status: 'error', last_scan_at: hoursAgo(30), next_scan_at: null },
        { status: 'paused', last_scan_at: null, next_scan_at: inHours(1) },
      ],
      openIncidents: 1,
      latestAuditRuns: [],
      now: NOW,
    });
    expect(header.status).toBe('active');
    expect(header.sources).toBe('2/4');
    expect(header.failingSources).toBe('1');
    expect(header.lastScan).toBe('vor 2 Std.');
    // Nur aktive Quellen bestimmen den nächsten Lauf (pausierte nicht).
    expect(header.nextScan).toBe('18:30');
  });

  it('jüngerer Website-Audit-Lauf gewinnt beim letzten Scan', () => {
    const header = buildMonitoringHeader({
      sources: [{ status: 'active', last_scan_at: hoursAgo(5), next_scan_at: null }],
      openIncidents: 0,
      latestAuditRuns: [{ created_at: hoursAgo(1) }],
      now: NOW,
    });
    expect(header.lastScan).toBe('vor 1 Std.');
    expect(header.nextScan).toBe('Nicht geplant');
  });

  it('nur pausierte/fehlerhafte Quellen ⇒ kein „AKTIV“', () => {
    const header = buildMonitoringHeader({
      sources: [{ status: 'paused', last_scan_at: null, next_scan_at: null }],
      openIncidents: 0,
      latestAuditRuns: [],
      now: NOW,
    });
    expect(header.status).toBe('no_sources');
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
    expect(src).toContain("from('monitoring_sources')");
    expect(src).toContain('monitoring-preview-notice');
  });
});
