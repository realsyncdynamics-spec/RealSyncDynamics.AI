import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync('src/features/governance/evidence/EvidenceVaultView.tsx', 'utf8');

describe('EvidenceVaultView — keine Demo-Daten im Live-Pfad', () => {
  it('seeden nicht mit atelier-nord', () => {
    expect(view).not.toMatch(/atelier-nord/i);
  });

  it('enthält keine fest verdrahteten Demo-Metriken oder Export-Jobs', () => {
    expect(view).not.toContain('1.247');
    expect(view).not.toContain('1.198');
    expect(view).not.toContain('12.06.2026');
    expect(view).not.toContain('EVIDENCE_TIMELINE');
    expect(view).not.toContain('RECENT_EXPORTS');
    expect(view).not.toContain('Wirtschaftsprüfer-Bundle');
    expect(view).not.toContain('Demo-Nachweis');
  });

  it('startet leer und lädt Events plus Snapshots ohne Mock-Fallback', () => {
    expect(view).toContain('useState<DbGovernanceEvent[]>([])');
    expect(view).toContain('useState<TimelineEntry[]>([])');
    expect(view).toContain('fetchTenantEvents');
    expect(view).toContain('listTimeline');
    expect(view).toContain('Promise.allSettled');
    expect(view).toContain('computeVaultMetrics(events)');
  });

  it('zeigt leere Zustände statt Demo-Diffs und Demo-Export-Historie', () => {
    expect(view).toContain('Keine Nachweise');
    expect(view).toContain('Keine Snapshots');
    expect(view).toContain('Kein Prüfpfad');
    expect(view).toContain('Kein Change-Log');
    expect(view).toContain('Keine Export-Historie');
  });
});
