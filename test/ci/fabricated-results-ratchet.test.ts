/**
 * Die Ratsche gegen selbst erfundene Werte.
 *
 * ## Warum es sie gibt
 *
 * Eine Fläche, die eine Zahl, eine Kennung oder einen Hash zeigt, behauptet
 * damit eine Messung. Am 2026-09-14 stimmte das an neun Stellen nicht — das
 * Monitoring-Dashboard würfelte „Ø Zeit bis Lösung", das Terminal würfelte
 * Findings-Zahl und Risiko-Stufe für die Domain des Nutzers, `getSeal()` gab
 * einen erfundenen SHA-256 als Siegel zurück, `/upgrade` baute eine Bezahl-URL
 * zusammen, die nirgendwo hinführte.
 *
 * Diese neun sind behoben. Der Punkt der Ratsche ist die zehnte: Solche
 * Stellen entstehen nicht aus Bosheit, sondern beim schnellen Ausfüllen einer
 * leeren Ansicht — und sehen danach aus wie fertige Funktionen.
 *
 * ## Warum eine Grundlinie und kein Verbot
 *
 * Der Bestand ist zum grössten Teil legitim: Jitter beim Retry, Sampling,
 * Partikel in den 3D-Szenen, lokale Kennungen. Ein pauschales Verbot wäre
 * falsch und würde sofort umgangen. Also wird der Bestand benannt und
 * eingeordnet; neue Fundstellen brechen den Lauf.
 *
 * Dieser Test prüft dreierlei: dass keine neue Fundstelle da ist, dass die
 * Grundlinie kein leeres Versprechen enthält (jeder Eintrag mit Art und
 * echter Begründung), und dass der Zähler selbst tut, was er behauptet.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compare, countIn, stripComments } from '../../scripts/check-fabricated-results.mjs';

const ROOT = resolve(__dirname, '../..');
const baseline = JSON.parse(
  readFileSync(resolve(ROOT, 'scripts/fabricated-results-baseline.json'), 'utf8'),
) as {
  arten: Record<string, string>;
  bestand: { datei: string; fundstellen: number; art: string; grund: string; seit: string }[];
};

describe('Keine neuen erfundenen Werte', () => {
  it('findet keine Fundstelle ausserhalb der Grundlinie', () => {
    const { neu, gewachsen } = compare();
    expect(neu, `Neue Datei(en): ${neu.map((n: { datei: string }) => n.datei).join(', ')}`).toEqual([]);
    expect(
      gewachsen,
      `Mehr Fundstellen als zuvor: ${gewachsen.map((g: { datei: string }) => g.datei).join(', ')}`,
    ).toEqual([]);
  });
});

describe('Die Grundlinie selbst', () => {
  it('ordnet jeden Eintrag einer dokumentierten Art zu', () => {
    const arten = Object.keys(baseline.arten);
    expect(arten).toEqual(expect.arrayContaining(['ZUFALL', 'ID', 'DEMO', 'BEFUND']));
    for (const eintrag of baseline.bestand) {
      expect(arten, `${eintrag.datei} hat die unbekannte Art ${eintrag.art}`).toContain(eintrag.art);
    }
  });

  it('lässt keinen Eintrag ohne belastbare Begründung durch', () => {
    for (const eintrag of baseline.bestand) {
      expect(eintrag.art, `${eintrag.datei} ist nie eingeordnet worden`).not.toBe('UNGEPRUEFT');
      expect(eintrag.grund.length, `${eintrag.datei} ohne belastbare Begründung`).toBeGreaterThan(40);
      expect(eintrag.seit).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(eintrag.fundstellen).toBeGreaterThan(0);
    }
  });

  it('nennt für jeden offenen Befund, wo er behoben wird', () => {
    // Ein BEFUND ohne Weg nach draussen wäre nur eine Notiz.
    for (const eintrag of baseline.bestand.filter((b) => b.art === 'BEFUND')) {
      expect(eintrag.grund, `${eintrag.datei} nennt keinen PR`).toMatch(/PR #\d+/);
    }
  });

  it('führt keine Datei doppelt', () => {
    const dateien = baseline.bestand.map((b) => b.datei);
    expect(new Set(dateien).size).toBe(dateien.length);
  });
});

describe('Der Zähler selbst', () => {
  it('zählt echten Code', () => {
    expect(countIn('const a = Math.random();')).toBe(1);
    expect(countIn('Math.random() + Math.random()')).toBe(2);
    expect(countIn('const a = 1;')).toBe(0);
  });

  it('zählt Kommentare nicht mit', () => {
    // Sonst würde die Begründung eines behobenen Falls als neuer Fall gelten —
    // genau das steht bei jedem Fix im Kommentar.
    expect(countIn('// vorher stand hier Math.random()')).toBe(0);
    expect(countIn('/* Math.random() war hier falsch */')).toBe(0);
    expect(countIn('/**\n * Math.random()\n */\nconst a = 1;')).toBe(0);
  });

  it('zählt Code hinter einem Kommentar in derselben Datei weiter', () => {
    expect(countIn('// Math.random()\nconst a = Math.random();')).toBe(1);
  });

  it('zerschneidet keine URL in einem String', () => {
    // Naives Entfernen von `//` würde die Zeile an `https://` abschneiden.
    const zeile = "const u = 'https://x.test'; const r = Math.random();";
    expect(stripComments(zeile)).toContain('Math.random');
    expect(countIn(zeile)).toBe(1);
  });
});
