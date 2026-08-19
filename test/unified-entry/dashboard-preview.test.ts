/**
 * Schritt 2 des Registrierungstrichters: `/unified-entry/preview`.
 *
 * ## Zwei Fehler, die diese Datei festhält
 *
 * **Die Vorschaubilder waren gestaucht.** Eine vollformatige Seite steckte
 * ungeskaliert in einem 224 px hohen Rahmen. Ihr eigenes CSS setzt
 * `font-size: clamp(38px, 7vw, 76px)`; bei rund 300 px Rahmenbreite sind 7vw
 * etwa 21 px, der Wert fällt also auf den Mindestwert 38 px — eine
 * 38-Pixel-Überschrift in einem 224-Pixel-Kasten, dazu eine Kopfzeile, deren
 * zwei Textblöcke ineinanderliefen. Ein Vorschaubild zeigt die Desktop-Ansicht
 * verkleinert; es quetscht sie nicht.
 *
 * **Die Seite behauptete mehr, als sie tut.** Der Scan ist echt — Score,
 * Tracker und Cookies kommen aus der URL des tatsächlichen Audits. Die drei
 * Entwürfe sind es nicht: `previewHtml()` liefert für jeden Besucher dieselben
 * Vorlagen und übernimmt nur den Domainnamen in die Kopfzeile. Sätze wie „So
 * könnte deine Website aussehen" versprachen eine Ableitung aus den Inhalten
 * des Besuchers, die nicht stattfindet.
 *
 * Der Unterschied ist wichtig genug für einen Test: Er ist die Grenze zwischen
 * einem Musterlayout und einer Aussage über das Eigentum des Kunden.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../../src/unified-entry/pages/DashboardPreviewPage.tsx'),
  'utf8'
);

/** Ohne Kommentare — dort steht die Begründung, nicht der Verstoß. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Vorschaubilder werden skaliert, nicht gestaucht', () => {
  it('rendert bei Desktop-Breite und rechnet herunter', () => {
    expect(code).toContain('const PREVIEW_VIEWPORT = 1280');
    expect(code).toMatch(/transform:\s*`scale\(\$\{scale\}\)`/);
    expect(code).toContain("transformOrigin: 'top left'");
  });

  it('misst die Rahmenbreite, statt einen Maßstab zu raten', () => {
    // Die Karten liegen in einem Grid, dessen Breite je Breakpoint wechselt.
    // Ein fest verdrahteter Maßstab wäre bei genau einer Fenstergröße richtig.
    expect(code).toContain('ResizeObserver');
    expect(code).toContain('clientWidth / PREVIEW_VIEWPORT');
  });

  it('lässt kein ungeskaliertes iframe mehr stehen', () => {
    // Genau diese Form war der Fehler: iframe mit fester Rahmenhöhe und
    // voller Breite, ohne Maßstab.
    const rawIframes = [...code.matchAll(/<iframe[^>]*>/g)].map((m) => m[0]);
    for (const tag of rawIframes) {
      expect(
        tag.includes('transform') || tag.includes('style={{'),
        `Ungeskaliertes iframe gefunden:\n${tag}`
      ).toBe(true);
    }
  });
});

describe('Die Seite verspricht nur, was sie tut', () => {
  it('nennt die Entwürfe Musterlayouts', () => {
    expect(code).toContain('Musterlayout');
  });

  it('behauptet nicht, die Vorschau sei die Website des Besuchers', () => {
    for (const claim of [
      'So könnte deine Website aussehen',
      'werden aus deiner bestehenden Website neu aufgebaut',
      'drei unterschiedliche Wege, sie sichtbar zu modernisieren',
    ]) {
      expect(code, `Überholte Zusage steht wieder in der Seite: „${claim}"`).not.toContain(claim);
    }
  });

  it('behält die Aussage zum Scan — die ist belegt', () => {
    // Score, Tracker, Cookies und auditId stammen aus der Audit-URL. Der Scan
    // hat stattgefunden; nur die Entwürfe sind nicht daraus abgeleitet. Diese
    // Unterscheidung soll beim nächsten Aufräumen nicht verlorengehen.
    expect(code).toContain('Der Scan deiner Website ist abgeschlossen');
    expect(code).toContain("params.get('auditId')");
  });
});

describe('Ein Schrittzähler, nicht zwei', () => {
  it('zählt in der Seite nicht gegen die Hülle', () => {
    // Die Hülle zeigt „Schritt 2 von 5". Ein zweiter Zähler „1 / 4" auf
    // demselben Bildschirm widersprach ihr sichtbar.
    expect(code).not.toMatch(/'[1-4] \/ 4'/);
  });

  it('benennt den inneren Fortschritt stattdessen', () => {
    for (const label of ['Gestaltung wählen', 'Vorschau', 'Kontakt', 'Angebot']) {
      expect(code).toContain(label);
    }
  });
});
