/**
 * Der prärenderte HTML-Stand darf nichts verbergen.
 *
 * ## Der Fehler, den dieser Test verhindert
 *
 * `scripts/prerender.mjs` speichert mit `page.content()` den **lebenden** DOM.
 * Alles, was JavaScript bis dahin hineingeschrieben hat, landet in der
 * ausgelieferten Datei — auch Zustand, der nur gilt, solange JavaScript läuft.
 *
 * Am 2026-08-19 traf das `useStagedReveal`: Der Hook markiert seinen Container
 * mit `data-reveal-root="ready"`, damit die Regel in `index.css` die Karten vor
 * dem Einblenden verbergen darf. Der Prerenderer ist eine JS-Umgebung, also kam
 * das Attribut mit in die Datei — der IntersectionObserver lief vor dem
 * Serialisieren aber nicht mehr, also fehlte `is-revealed`. In der auf
 * Cloudflare ausgelieferten Startseite standen dadurch 22 sichtbar gemeinte
 * Elemente auf `opacity: 0`, darunter die gesamte Enterprise-Sektion.
 *
 * Mit ausgeführtem JavaScript heilt sich das nach der Hydration. Für einen
 * Crawler ohne JS-Ausführung, ein abgebrochenes Bundle oder abgeschaltetes
 * JavaScript bleibt die Seite leer.
 *
 * ## Warum der Test so aussieht
 *
 * Geprüft wird die **Kopplung** aus zwei Dateien, nicht ein Ausgabeartefakt:
 * Der Prerenderer muss den Zustand entfernen, und das CSS darf ausschließlich
 * unter genau diesem Zustand verbergen. Stimmt eines von beiden nicht mehr,
 * kehrt der Fehler zurück — und zwar unsichtbar, weil die Seite im Browser
 * weiterhin richtig aussieht.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const prerender = readFileSync(resolve(root, 'scripts/prerender.mjs'), 'utf8');
const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const hook = readFileSync(resolve(root, 'src/hooks/useStagedReveal.ts'), 'utf8');

describe('Prerender-Hygiene: nichts Verborgenes im gespeicherten HTML', () => {
  it('entfernt den Reveal-Zustand vor dem Serialisieren', () => {
    expect(prerender).toContain('stripRuntimeOnlyState');
    expect(prerender).toContain("removeAttribute('data-reveal-root')");
    expect(prerender).toContain("classList.remove('is-revealed')");
  });

  it('räumt auf, bevor `page.content()` läuft — nicht danach', () => {
    const strip = prerender.indexOf('await stripRuntimeOnlyState(page)');
    const serialize = prerender.indexOf('await page.content()');
    expect(strip, 'Aufräumschritt fehlt im Renderpfad').toBeGreaterThan(-1);
    expect(serialize).toBeGreaterThan(-1);
    expect(
      strip,
      'Nach dem Serialisieren aufzuräumen ändert an der gespeicherten Datei nichts.'
    ).toBeLessThan(serialize);
  });

  it('verbirgt im CSS ausschließlich unter dem Zustand, den der Prerenderer entfernt', () => {
    // Genau diese Kopplung macht das Aufräumen ausreichend. Käme eine zweite,
    // vom Attribut unabhängige Versteck-Regel dazu, griffe sie im prärenderten
    // HTML weiter — und der Fehler wäre zurück, ohne dass der Test es merkt.
    // Regelweise zerlegen statt mit einer Regex in den Selektor zu greifen:
    // `[^{]*` beginnt sonst mitten im Selektor und schneidet den davor
    // stehenden Vorfahren `[data-reveal-root='ready']` ab — der Test meldete
    // dann einen Fehler, den es nicht gab.
    const withoutMediaWrappers = css.replace(/@media[^{]*\{/g, '');
    const rules = [...withoutMediaWrappers.matchAll(/([^{}]+)\{([^{}]*)\}/g)];

    const hidingRules = rules.filter(
      ([, selector, body]) => selector.includes('[data-reveal]') && /opacity:\s*0\s*;/.test(body)
    );
    expect(hidingRules.length, 'Keine Versteck-Regel gefunden — Selektor geändert?').toBeGreaterThan(0);

    for (const [, selector] of hidingRules) {
      expect(
        selector.includes("[data-reveal-root='ready']"),
        `Versteck-Regel ohne Bindung an data-reveal-root:\n${selector.trim()}`
      ).toBe(true);
    }
  });

  it('setzt den Zustand im Hook nur zur Laufzeit und nimmt ihn zurück', () => {
    expect(hook).toContain("setAttribute('data-reveal-root', 'ready')");
    expect(
      hook.includes("removeAttribute('data-reveal-root')"),
      'Ohne Aufräumen beim Unmount bleibt der Zustand an einem toten Container hängen.'
    ).toBe(true);
  });

  it('lässt Bewegungsreduktion gar nicht erst verstecken', () => {
    // Der Hook kehrt bei reduzierter Bewegung vor dem Markieren zurück. Ohne
    // das wäre der Grundzustand versteckt und die Reduktion würde ihn nie
    // aufheben — die Seite bliebe für genau die Nutzer leer, die weniger
    // Bewegung angefordert haben.
    const guardIndex = hook.indexOf('prefers-reduced-motion');
    const markIndex = hook.indexOf("setAttribute('data-reveal-root', 'ready')");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(markIndex);
  });
});
