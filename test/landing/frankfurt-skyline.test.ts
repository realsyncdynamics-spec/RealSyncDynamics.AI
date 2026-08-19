/**
 * Die Skyline muss Frankfurt bleiben.
 *
 * ## Warum das prüfenswert ist
 *
 * Eine beliebige Hochhausreihe ist keine Skyline, sondern Dekoration. Frankfurt
 * erkennt man an vier Formen: der Pyramide des Messeturms, der Antenne des
 * Commerzbank-Towers, der Krone der Westendstraße 1 und dem Domturm. Wer beim
 * Aufräumen die Dachformen vereinheitlicht — was verlockend ist, weil der Code
 * dadurch kürzer wird —, bekommt eine Reihe grauer Kästen, die überall stehen
 * könnte. Der Verlust fällt niemandem auf, weil nichts kaputtgeht.
 *
 * ## Und sie muss bei jedem Rendern dieselbe sein
 *
 * Die Füllbebauung ist eine feste Liste. Mit `Math.random()` ergäbe der
 * Prerender eine andere Stadt als der Browser — nach der Hydration würde die
 * Skyline sichtbar umspringen. Deshalb wird ausdrücklich auf Zufall geprüft.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../../src/components/landing/FrankfurtSkyline.tsx'),
  'utf8'
);

/**
 * Quelltext ohne Kommentare.
 *
 * Im Kommentar darf und soll stehen, warum kein `Math.random()` verwendet
 * wird — der erste Entwurf dieses Tests fiel genau darüber, weil er die
 * Begründung für den Verstoß hielt.
 */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Baukörper aus der Liste im Quelltext ziehen. */
const buildings = [...source.matchAll(/\{\s*x:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)([^}]*)\}/g)].map(
  (m) => ({
    x: Number(m[1]),
    w: Number(m[2]),
    h: Number(m[3]),
    rest: m[4],
  })
);

describe('Frankfurter Skyline', () => {
  it('liest überhaupt Baukörper aus der Liste', () => {
    // Ohne diese Zusicherung prüfte alles Folgende eine leere Liste.
    expect(buildings.length).toBeGreaterThan(20);
  });

  it('behält die vier Formen, an denen man die Stadt erkennt', () => {
    for (const shape of ['pyramid', 'crown', 'spire'] as const) {
      expect(source, `Dachform '${shape}' fehlt — ohne sie ist es irgendeine Stadt`).toContain(
        `'${shape}'`
      );
    }
    // Die Antenne des höchsten Baus.
    expect(buildings.some((b) => /mast:\s*[1-9]/.test(b.rest))).toBe(true);
  });

  it('lässt den höchsten Bau auch den höchsten bleiben', () => {
    // Der Commerzbank-Tower trägt die Antenne. Stünde ein Füllbau höher,
    // stimmten die Verhältnisse nicht mehr und die Reihe wirkte beliebig.
    const withMast = buildings.filter((b) => /mast:\s*[1-9]/.test(b.rest));
    const tallest = Math.max(...buildings.map((b) => b.h));
    expect(withMast.some((b) => b.h === tallest)).toBe(true);
  });

  it('verwendet keinen Zufall', () => {
    // Zufall ergäbe im prärenderten HTML eine andere Stadt als im Browser.
    expect(code).not.toMatch(/Math\.random|Date\.now/);
  });

  it('vergibt eindeutige React-Schlüssel', () => {
    // Die Schlüssel sind `${x}-${h}`. Zwei gleiche Paare wären eine stille
    // Kollision — React verwirft dann still einen der Baukörper.
    const keys = buildings.map((b) => `${b.x}-${b.h}`);
    expect(new Set(keys).size, 'doppelter Schlüssel in BUILDINGS').toBe(keys.length);
  });

  it('ist dekorativ und wird nicht vorgelesen', () => {
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('focusable="false"');
  });

  it('bleibt in der Farbwelt — kein warmer Akzent', () => {
    // Frage 1 der Drei-Fragen-Regel wurde zweimal mit Nein beantwortet.
    // Ein Sonnenaufgang in Orange käme am ehesten hier wieder herein.
    const warm = source.match(/#(f{2}[0-9a-f]{2}[0-9a-f]{2}|[ef][0-9a-f]{5})/gi) ?? [];
    const offenders = warm.filter((hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      // Warm = deutlich mehr Rot als Blau. Weiss und Cyan fallen nicht darunter.
      return r > b + 24 && r > g;
    });
    expect(offenders, `warme Farbwerte gefunden: ${offenders.join(', ')}`).toEqual([]);
  });
});
