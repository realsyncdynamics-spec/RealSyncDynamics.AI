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
 * Entwürfe waren es nicht: `previewHtml()` lieferte für jeden Besucher
 * dieselben Vorlagen und übernahm nur den Domainnamen in die Kopfzeile. Sätze
 * wie „So könnte deine Website aussehen" versprachen eine Ableitung aus den
 * Inhalten des Besuchers, die nicht stattfand.
 *
 * Der Unterschied ist wichtig genug für einen Test: Er ist die Grenze zwischen
 * einem Musterlayout und einer Aussage über das Eigentum des Kunden.
 *
 * ## Was sich 2026-08-19 geändert hat
 *
 * Die Seite ruft jetzt den vorhandenen Generator auf: `parseBrief` →
 * `synthesizeBlueprint` → `applySiteDesignTemplate` → `renderSite`. Die
 * Entwürfe sind damit **echt erzeugt** und je Domain verschieden — das Wort
 * „Musterlayout" wäre nun die falsche Aussage.
 *
 * Die Sperre bleibt, ihre Richtung dreht sich:
 *
 * - Vorher erzwungen: nenne die Entwürfe Musterlayouts.
 * - Jetzt erzwungen: rufe den Generator wirklich auf (kein Rückfall auf
 *   handgebautes HTML) **und** behaupte trotzdem nicht, die Texte stammten aus
 *   den bestehenden Inhalten des Besuchers.
 *
 * Denn genau das tun sie nicht: Sie stammen aus Domainname und erkannter
 * Branche. Die echten Inhalte liest `siteos/discover`, und das braucht einen
 * angemeldeten Tenant. Zwischen „echt erzeugt" und „aus deinen Inhalten"
 * liegt weiterhin eine Grenze — sie verläuft nur an einer anderen Stelle.
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
  it('erzeugt die Entwürfe wirklich, statt HTML zusammenzusetzen', () => {
    // Der Rückfall, den dieser Test verhindert: wieder eine handgebaute
    // `previewHtml()`, die drei feste Vorlagen liefert. Wer die Kette hier
    // herausnimmt, muss auch die Zusagen in der Seite zurücknehmen.
    for (const call of ['parseBrief(', 'synthesizeBlueprint(', 'applySiteDesignTemplate(', 'renderSite(']) {
      expect(code, `Generator-Aufruf fehlt: ${call}`).toContain(call);
    }
    expect(code, 'Handgebautes Vorschau-HTML ist zurück').not.toContain('function previewHtml');
  });

  it('führt die drei Auswahlkarten auf die echten Templates zurück', () => {
    // Die alten Varianten waren Nachbauten von SITE_DESIGN_TEMPLATES. Ein
    // zweiter Satz eigener IDs würde denselben Zustand wiederherstellen.
    expect(code).toContain('SITE_DESIGN_TEMPLATES');
    for (const id of ['modern-minimal', 'bento-bold', 'dark-professional']) {
      expect(code, `Template-ID fehlt: ${id}`).toContain(id);
    }
  });

  it('behauptet nicht, die Vorschau sei aus den Inhalten des Besuchers gebaut', () => {
    // Erzeugt ist sie — aber aus Domain und Branche, nicht aus den
    // bestehenden Texten. Diese Grenze bleibt bestehen.
    for (const claim of [
      'So könnte deine Website aussehen',
      'werden aus deiner bestehenden Website neu aufgebaut',
      'drei unterschiedliche Wege, sie sichtbar zu modernisieren',
      'aus deinen bestehenden Inhalten neu aufgebaut',
    ]) {
      expect(code, `Überholte Zusage steht wieder in der Seite: „${claim}"`).not.toContain(claim);
    }
  });

  it('benennt, woher die Texte stammen', () => {
    // Ohne diesen Satz stünde eine erzeugte Seite ohne Herkunftsangabe da.
    expect(code).toContain('erkannten Branche');
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
