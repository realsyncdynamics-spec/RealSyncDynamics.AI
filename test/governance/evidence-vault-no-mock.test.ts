import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync('src/features/governance/evidence/EvidenceVaultView.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

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
    expect(view).toContain('fetchTenantEvents');
    expect(view).toContain('fetchTenantEvidence');
    expect(view).toContain('listTimeline');
    expect(view).toContain('mergeTimeline');
    expect(view).toContain('countTenantEvidence');
    expect(view).toContain('Promise.allSettled');
    expect(view).not.toContain('.catch(() => []');
  });

  it('zeigt leere Zustände statt Demo-Diffs und Demo-Export-Historie', () => {
    expect(view).toContain('Noch keine Nachweise');
    expect(view).toContain('Noch keine Snapshots');
    expect(view).toContain('Noch kein Prüfpfad');
    expect(view).toContain('Keine dokumentierten Änderungen');
    expect(view).toContain('Keine Export-Historie in dieser Ansicht');
    expect(view).toContain('Nachweise nicht verfügbar');
    expect(view).toContain('Prüfpfad nicht verfügbar');
    expect(view).toContain('Änderungen nicht verfügbar');
    expect(view).toContain('(eventsFailed || evidenceFailed) && items.length === 0');
  });
});

describe('/app/evidence ist auth-gegatet', () => {
  it('hängt hinter AppGate, analog zum Dashboard', () => {
    const line = app.split('\n').find((text) => text.includes('path="/app/evidence"'));
    expect(line, 'Route /app/evidence nicht gefunden').toBeDefined();
    expect(line).toContain('<AppGate>');
    expect(line).toContain('EvidenceVaultView');
  });
});
