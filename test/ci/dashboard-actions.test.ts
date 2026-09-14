/**
 * Das Inventar der Dashboard-Aktionen darf dem Code nicht voraus sein.
 *
 * ## Warum es diesen Test gibt
 *
 * Issue #1381 §8 setzt zehn Abnahme-Gates für eine Dashboard-Aktion. Das
 * wichtigste Ergebnis der Inventur war nicht, dass vieles fehlt, sondern dass
 * man es einer Fläche nicht ansieht: `/app/agents` führt einen echten,
 * abgerechneten Run aus und schreibt nach `enterprise_agent_runs`.
 * `/app/automations` sieht genauso aus — Karten mit Button.
 *
 * Die erste Fassung dieses Inventars hat `/app/automations` als
 * NOT_IMPLEMENTED geführt, mit der Begründung, es gebe „keine Engine und keine
 * Tabelle". Das war falsch, und zwar aus dem Grund, den die Ratsche eigentlich
 * ausschliessen soll: übernommen aus einem veralteten Quellkommentar
 * (`src/content/automationSkills.ts:3-6`), statt am Code geprüft. Tatsächlich
 * existieren vier Tabellen, zwei Edge Functions, ein Entitlement-Gate und ein
 * Verbrauchszähler. Der Pfad ist vorhanden — er ist unterbrochen.
 *
 * Daher der Zustand BROKEN: „kein Backend" und „Backend, das nichts liefert"
 * sind verschiedene Befunde. Eine Ratsche, die beide gleich benennt, deckt den
 * zweiten nie auf.
 */
import { describe, expect, it } from 'vitest';
import { ladeInventar, pruefe } from '../../scripts/check-dashboard-actions.mjs';

const inventar = ladeInventar() as {
  zustaende: Record<string, string>;
  aktionen: {
    id: string; route: string; komponente: string; handler: string;
    backend: string | null; status: string; luecke: string; beleg: string; seit: string;
  }[];
};

/** Minimal-App-Quelle für die Verhaltensproben — nur die Route zählt. */
const APP = 'path="/app/test"';
const eintrag = (over: Record<string, unknown> = {}) => ({
  id: 'probe', route: '/app/test',
  komponente: 'scripts/check-dashboard-actions.mjs',
  handler: 'scripts/check-dashboard-actions.mjs',
  // Eine Datei, die wirklich einen Backend-Aufruf enthält — sonst feuert die
  // Backend-Regel und verdeckt den Befund, den die Probe messen will.
  backend: 'src/features/bots/api.ts',
  status: 'IMPLEMENTED', luecke: '',
  beleg: 'Beleg mit ausreichender Länge für die Prüfung.',
  seit: '2026-09-14', ...over,
});
const probe = (over: Record<string, unknown> = {}) =>
  pruefe({ aktionen: [eintrag(over)] }, APP) as { id: string; text: string }[];

describe('Inventar und Code stimmen überein', () => {
  it('meldet keinen Befund', () => {
    const befunde = pruefe() as { id: string; text: string }[];
    expect(befunde.map((b) => `${b.id}: ${b.text}`)).toEqual([]);
  });

  it('deckt die sechs P0-Flächen aus Issue #1381 ab', () => {
    const routen = new Set(inventar.aktionen.map((a) => a.route));
    for (const route of ['/app/bots', '/app/agents', '/app/automations', '/build', '/app/siteos/builder', '/app/websites']) {
      expect(routen.has(route), `${route} fehlt im Inventar`).toBe(true);
    }
  });

  it('dokumentiert jeden verwendeten Zustand', () => {
    for (const a of inventar.aktionen) {
      expect(Object.keys(inventar.zustaende), a.id).toContain(a.status);
    }
  });

  it('lässt keine Aktion ohne Beleg oder Datum durch', () => {
    for (const a of inventar.aktionen) {
      expect(a.beleg.length, a.id).toBeGreaterThan(29);
      expect(a.seit, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('Die Ratsche weist Falschbehauptungen zurück', () => {
  it('beanstandet die saubere Probe nicht', () => {
    // Ohne diese Zusicherung könnte jede folgende Probe aus dem falschen
    // Grund fehlschlagen — beim Schreiben ist genau das passiert.
    expect(probe()).toEqual([]);
  });

  it('nimmt IMPLEMENTED ohne Backend nicht ab', () => {
    expect(probe({ backend: null })[0].text).toContain('ohne Backend');
  });

  it('nimmt IMPLEMENTED nicht ab, wenn die Datei keinen Backend-Aufruf enthält', () => {
    // package.json existiert, enthält aber keinen functions.invoke/.from()-Aufruf.
    expect(probe({ backend: 'package.json' })[0].text).toContain('keinen Backend-Aufruf');
  });

  it('nimmt NOT_IMPLEMENTED mit Backend nicht ab', () => {
    const befunde = probe({ status: 'NOT_IMPLEMENTED', luecke: 'keine Engine' });
    expect(befunde.some((b) => b.text.includes('nennt ein Backend'))).toBe(true);
  });

  it('nimmt CLIENT_ONLY mit Backend nicht ab', () => {
    const befunde = probe({ status: 'CLIENT_ONLY', luecke: 'nur localStorage' });
    expect(befunde.some((b) => b.text.includes('nennt ein Backend'))).toBe(true);
  });

  it('besteht auf einer benannten Lücke, wo etwas fehlt', () => {
    expect(probe({ status: 'PARTIAL', luecke: '' }).some((b) => b.text.includes('ohne benannte Lücke'))).toBe(true);
  });

  it('lässt IMPLEMENTED mit offener Lücke nicht durch', () => {
    expect(probe({ luecke: 'da fehlt noch was' })[0].text).toContain('Dann ist es PARTIAL');
  });

  it('merkt, wenn die Route gar nicht existiert', () => {
    expect(probe({ route: '/app/gibt-es-nicht' })[0].text).toContain('steht nicht in src/App.tsx');
  });

  it('merkt, wenn eine genannte Datei fehlt', () => {
    expect(probe({ handler: 'src/gibt-es-nicht.ts' })[0].text).toContain('existiert nicht');
  });

  it('erkennt einen unbekannten Zustand', () => {
    expect(probe({ status: 'FERTIG' })[0].text).toContain('Unbekannter Zustand');
  });

  it('nimmt BROKEN ohne Backend nicht ab', () => {
    // BROKEN heisst: der Pfad ist da und tot. Wer ihn nicht zeigen kann,
    // meint NOT_IMPLEMENTED und soll das auch schreiben.
    const befunde = probe({ status: 'BROKEN', backend: null, luecke: 'Pfad bricht ab' });
    expect(befunde.some((b) => b.text.includes('ohne Backend'))).toBe(true);
  });

  it('nimmt BROKEN mit belegtem Backend und benannter Lücke an', () => {
    expect(probe({ status: 'BROKEN', luecke: 'Antwort-Vertrag passt nicht' })).toEqual([]);
  });
});
