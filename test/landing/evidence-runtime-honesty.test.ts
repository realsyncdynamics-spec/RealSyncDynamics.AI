/**
 * Copy-Ehrlichkeit /evidence-runtime — Hero und Closed Loop dürfen
 * Dauerbetrieb / Re-Scan-Closure nicht als Ist-Zustand verkaufen.
 * Registry-Status (Verification Plane = ZIELBILD, Builder = Preview,
 * continuous-domain-monitoring = Coming Soon) bleibt die SSoT.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync('src/pages/EvidenceRuntime.tsx', 'utf8');

describe('EvidenceRuntime — Copy-Ehrlichkeit', () => {
  it('markiert fortlaufend im Hero als Zielbild', () => {
    expect(SRC).toContain('fortlaufend als Zielbild');
    expect(SRC).not.toMatch(/erzeugen — fortlaufend\./);
  });

  it('formuliert den Closed Loop als Zielbild, nicht als Ist-Zustand', () => {
    expect(SRC).toContain('Das Zielbild von RealSyncDynamics.AI');
    expect(SRC).toContain('Ein Befund soll erst als behoben gelten');
    expect(SRC).toContain(
      'Zielbild: Monitor führt zurück zu Detect — jede Änderung startet den Loop neu.',
    );
    expect(SRC).not.toContain('Ein Befund gilt erst als behoben');
    expect(SRC).not.toContain('Monitor führt zurück zu Detect: jede Änderung startet den Loop neu.');
  });

  it('vermeidet verbotene Vertriebs-/Pilot-Wörter in der öffentlichen Copy', () => {
    const publicCopy = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const word of ['Pilot', 'Demo', 'Call', 'Sales', 'Beratung', 'Termin']) {
      // Pfad-/Konstantennamen (contact-sales, SALES_CTA) sind keine sichtbare Copy.
      const visible = publicCopy
        .replace(/SALES_CTA/g, '')
        .replace(/contact-sales/g, '')
        .replace(/source=evidence-runtime/g, '');
      expect(visible).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
    }
  });
});
