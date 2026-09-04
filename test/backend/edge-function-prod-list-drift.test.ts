/**
 * Der Wächter über der Wächter-Eingabe.
 *
 * ## Was am 2026-09-04 passiert ist
 *
 * `src/config/production-edge-functions.ts` ist keine Dokumentation, sondern
 * Laufzeit-Eingabe: `isEdgeFunctionInProduction()` entscheidet daran, ob die
 * Oberfläche einen „noch nicht verfügbar"-Hinweis zeigt, und
 * `test/backend/edge-function-contract.test.ts` prüft daran, ob ein Eintrag
 * aus `UNBACKED_CALLERS` ausgetragen gehört.
 *
 * Die Liste stand auf der Messung vom 2026-08-23 (178). Deployt waren am
 * 2026-09-04 aber 181 — `audit-claim`, `onboarding-orchestrator` und
 * `subscription-addons` fehlten. Folge: Der Test „meldet Einträge in
 * UNBACKED_CALLERS, die inzwischen deployt sind" konnte `subscription-addons`
 * nicht sehen und blieb grün. Ein Wächter mit veralteter Eingabe meldet nicht
 * weniger zuverlässig — er meldet gar nicht.
 *
 * Bis dahin sah **keine** Automatik diese Liste an: `check:edge-functions`
 * verglich ausschliesslich Repo gegen Produktion. Diese Datei prüft die
 * Vergleichslogik, die das schliesst.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProductionList, compareAgainstConfigList } from '../../scripts/check-edge-function-drift.mjs';

const QUELLE = resolve(__dirname, '../../src/config/production-edge-functions.ts');

describe('parseProductionList', () => {
  it('liest die echte Liste aus der echten Datei', () => {
    const slugs = parseProductionList(readFileSync(QUELLE, 'utf8'));
    if (!slugs) throw new Error('PRODUCTION_EDGE_FUNCTIONS nicht lesbar');
    expect(slugs.size).toBeGreaterThan(150);
    expect(slugs.has('gdpr-audit')).toBe(true);
  });

  it('gibt null zurück, wenn der Export nicht mehr die erwartete Form hat', () => {
    // Wichtiger als er aussieht: Ein Parser, der bei unbekannter Form eine
    // leere Menge liefert, meldete „alles deployt, nichts in der Liste" —
    // ein Fehlalarm über 181 Zeilen. Und liefe er auf `[]` hinaus, meldete er
    // gar nichts. `null` zwingt den Aufrufer, den Fall zu benennen.
    expect(parseProductionList('export const ETWAS_ANDERES = [];')).toBeNull();
  });
});

describe('compareAgainstConfigList', () => {
  it('meldet nichts, wenn beide Mengen gleich sind', () => {
    expect(compareAgainstConfigList(['a', 'b'], ['b', 'a'])).toEqual({
      missingFromList: [], notDeployed: [],
    });
  });

  it('meldet den Fall vom 2026-09-04: deployt, aber nicht in der Liste', () => {
    const { missingFromList, notDeployed } = compareAgainstConfigList(
      ['audit-claim', 'gdpr-audit', 'onboarding-orchestrator', 'subscription-addons'],
      ['gdpr-audit'],
    );
    expect(missingFromList).toEqual(['audit-claim', 'onboarding-orchestrator', 'subscription-addons']);
    expect(notDeployed).toEqual([]);
  });

  it('meldet die andere Richtung: in der Liste, aber nicht deployt', () => {
    // Der teurere Fehler — ein Knopf, der ins Leere ruft. Genau dafür wurde
    // die Liste angelegt.
    const { missingFromList, notDeployed } = compareAgainstConfigList(
      ['gdpr-audit'],
      ['gdpr-audit', 'erfundene-function'],
    );
    expect(notDeployed).toEqual(['erfundene-function']);
    expect(missingFromList).toEqual([]);
  });

  it('prüft beide Richtungen gleichzeitig — Zahlengleichheit ist kein Beleg', () => {
    // CLAUDE.md §5: Repo und Produktion zeigten beide „179" und waren
    // trotzdem verschiedene Mengen. Gleiche Grösse, andere Elemente.
    const { missingFromList, notDeployed } = compareAgainstConfigList(['a', 'b'], ['a', 'c']);
    expect(missingFromList).toEqual(['b']);
    expect(notDeployed).toEqual(['c']);
  });
});
