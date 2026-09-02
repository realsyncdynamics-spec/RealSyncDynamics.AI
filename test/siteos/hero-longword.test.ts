// Lange einteilige Firmennamen duerfen im Hero nicht abgeschnitten werden.
//
// ## Hergang
//
// Gefunden am 2026-09-01 beim Nachstellen der Vorschau mit einem echten
// Browser. Der Hero-Block der Layoutschicht begrenzt die Ueberschrift auf
// `max-width:16ch` und traegt `overflow:hidden`. Ein Firmenname ohne
// Leerzeichen ist aber ein einziges Wort, und ein Wort bricht bei
// `overflow-wrap:normal` nicht — der Ueberhang wurde deshalb nicht
// umgebrochen, sondern weggeschnitten.
//
// Gemessen in Chromium bei 1280px: „RealSyncDynamics.AI" ergab 648px Text in
// einem 570px breiten Kasten. 78px fehlten, sichtbar im Screenshot.
//
// Bei Markennamen und Domains ist der einteilige Name der Normalfall.
//
// ## Warum die Pruefung am CSS ansetzt und nicht am Pixel
//
// Ein Pixel-Test braucht einen Browser und misst eine Schriftart, die auf dem
// CI-Runner eine andere sein kann als hier. Was den Fehler ausmacht, ist eine
// Eigenschaft des Stylesheets: Begrenzung plus `overflow:hidden` ohne
// Umbruchregel. Genau diese Kombination wird geprueft.
//
// Freigabe des Eigentuemers vom 2026-09-01 nach CLAUDE.md §10.3:
// „Ja — break-word ergaenzen".

import { describe, it, expect } from 'vitest';
import { renderPresentationCss } from '../../packages/siteos-core/src/render/presentation';
import { parseBrief, mergeBrief } from '../../packages/siteos-core/src/blueprint/brief';
import { synthesizeBlueprint } from '../../packages/siteos-core/src/blueprint/synthesize';
import { renderSite } from '../../packages/siteos-core/src/render/renderer';

const css = renderPresentationCss({
  mode: 'light', accent: '#145CFF', surface: '#F7F8FA', foreground: '#111827',
  fontDisplay: 'Inter, sans-serif', fontBody: 'Inter, sans-serif', radiusPx: 14,
});

/** Der Regelblock fuer die Hero-Ueberschrift, ohne Zeilenumbrueche im Quelltext. */
function heroHeadingRule(): string {
  const match = /\[id\*="--hero--"\]>h1[^{]*\{([^}]*)\}/.exec(css);
  expect(match, 'Regelblock fuer die Hero-Ueberschrift nicht gefunden').not.toBeNull();
  return match![1];
}

describe('Hero-Ueberschrift — langer einteiliger Name', () => {
  it('begrenzt die Breite, wie es die Gestaltung vorsieht', () => {
    // Ohne diese Zusicherung wuerde die Pruefung unten bedeutungslos: Faellt
    // die Begrenzung weg, gibt es nichts mehr, woran der Text haengenbliebe.
    expect(heroHeadingRule()).toContain('max-width:16ch');
  });

  it('erlaubt den Umbruch innerhalb eines Wortes', () => {
    expect(heroHeadingRule()).toContain('overflow-wrap:break-word');
  });

  it('nutzt nicht `anywhere` — das laesst die Textspalte zusammenfallen', () => {
    // `anywhere` zaehlt bei der Mindestbreite mit. Gemessen sackte die Spalte
    // damit von 570px auf 226px, und die Ueberschrift brach dreizeilig mitten
    // im Wort. Der Ueberlauf war weg, das Raster kaputt.
    expect(heroHeadingRule()).not.toContain('overflow-wrap:anywhere');
  });

  it('haelt den Ueberhang weiterhin verdeckt — deshalb braucht es den Umbruch', () => {
    // Die Begruendung fuer die Regel steht in dieser Zeile: Ohne
    // `overflow:hidden` waere ein Ueberlauf haesslich, aber lesbar. Mit ihm
    // ist er weg.
    expect(css).toContain('[id*="--hero--"]{position:relative;overflow:hidden;');
  });

  it('rendert einen einteiligen Namen vollstaendig ins Dokument', () => {
    // Der Name darf im HTML nicht gekuerzt werden — das Abschneiden war rein
    // visuell, und genau deshalb faellt es keinem Text-Test auf.
    const brief = mergeBrief(parseBrief('AI Governance Runtime fuer Unternehmen'), {
      name: 'RealSyncDynamics.AI',
    });
    const html = renderSite(synthesizeBlueprint(brief), { presentation: 'showcase' })
      .find((page) => page.path === '/')!.html;

    expect(html).toContain('<h1>RealSyncDynamics.AI</h1>');
  });
});
