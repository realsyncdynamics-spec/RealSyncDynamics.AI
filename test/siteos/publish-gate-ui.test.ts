// Regel G2 als Prüfung am Quelltext.
//
// „Das Frontend rendert `publishable` und die Begründung — es leitet sie nie
// aus Einzelfeldern ab." Diese Regel lässt sich nicht sinnvoll durch
// Rendern prüfen: Ein Frontend, das falsch ableitet, sieht bei passenden
// Testdaten genauso aus wie eines, das richtig rendert. Der Unterschied
// steht im Quelltext, also wird er dort geprüft.
//
// Dieselbe Bauart wie die übrigen Ehrlichkeits-Prüfungen im Repo
// (test/unified-entry/dashboard-preview.test.ts): Sie schlägt fehl, sobald
// jemand die Ableitung ins Frontend zurückholt — auch wenn das Ergebnis
// zufällig stimmt.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../../src/features/siteos/SiteOsClaimView.tsx'),
  'utf8',
);

describe('Publish Gate im Frontend — G2', () => {
  it('rendert publishable, statt es abzuleiten', () => {
    expect(source).toContain('evaluation.publishable');
  });

  it('rechnet die Ableitungsregel nicht nach', () => {
    // Die fünf Contract-Felder dürfen im Frontend nicht miteinander
    // verknüpft werden. Einzeln anzeigen ist erlaubt — verknüpfen nicht.
    const derived = [
      /evidence_complete\s*&&/,
      /policy_compliant\s*&&/,
      /&&\s*evaluation\.evidence_complete/,
      /&&\s*evaluation\.policy_compliant/,
      /human_approval_required\s*===\s*false/,
      /backend_preservation\s*===\s*'preserve_all'/,
    ];
    for (const pattern of derived) {
      expect(source).not.toMatch(pattern);
    }
  });

  it('zeigt den Prüfpfad-Anker aus G5', () => {
    expect(source).toContain('evaluation_id');
    expect(source).toContain('artifact_sha256');
  });

  it('unterscheidet einen nicht ausgerollten Endpunkt von einem Fehler', () => {
    // Ein 404 des Routers heißt „noch nicht deployt", nicht „kaputt".
    // Als allgemeiner Fehler angezeigt, sucht der Nutzer den Fehler bei sich.
    expect(source).toContain("not_deployed");
    expect(source).toMatch(/noch nicht ausgerollt/);
  });

  it('lässt eine fehlgeschlagene Bewertung die Übernahme nicht rückgängig machen', () => {
    // Die Site gehört dem Mandanten ab dem erfolgreichen Build. Ein
    // Prüffehler danach ist ein eigener Befund, kein Abbruch — sonst stünde
    // der Kunde vor „Übernahme fehlgeschlagen", obwohl sie gelungen ist.
    expect(source).toContain('gateNote');
    expect(source).not.toMatch(/setPhase\('failed'\)[\s\S]{0,200}evaluatePublish/);
  });
});
