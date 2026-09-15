// Stylesheet für die Editor-Leinwand.
//
// Die Leinwand von Puck rendert jeden Block in einem eigenen Wrapper (für
// Auswahl, Ziehen, Einfügen). Die Layoutschicht des Renderers spricht
// Blöcke aber über die Dokumentstruktur an — `body>header`, `body main>section`
// —, die es in der Leinwand so nicht gibt. Damit die Leinwand aussieht wie die
// Seite, werden genau diese Strukturselektoren auf den Block-Wrapper
// umgeschrieben. Alles Übrige (`[id*="--hero--"]`, Farben, Typografie) bleibt
// wörtlich das Stylesheet des Renderers; hier entsteht keine zweite Optik.
//
// Warum das keine Änderung an `presentation.ts` ist: Der Renderer darf sein
// Markup nicht anfassen (siehe dessen Kopf), und das ausgelieferte Dokument
// soll `body>header` weiter tragen. Die Umschreibung gilt nur für die
// Leinwand — die sandboxed Vorschau zeigt weiterhin das echte Dokument.

import { renderPresentationCss, renderThemeCss, type SiteTheme } from '../../../../packages/siteos-core/src/index';

/** Attribut, das jeder Block-Wrapper in der Leinwand trägt. */
export const BLOCK_WRAPPER_ATTR = 'data-siteos-block';

const WRAPPER = `[${BLOCK_WRAPPER_ATTR}]`;

/**
 * Strukturselektoren der Layoutschicht, in der Reihenfolge, in der sie
 * ersetzt werden müssen (der längere Präfix zuerst).
 */
const STRUCTURAL_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['body main>', `${WRAPPER}>`],
  ['body>', `${WRAPPER}>`],
];

/** Schreibt die Strukturselektoren der Layoutschicht auf den Block-Wrapper um. */
export function adaptPresentationCssForCanvas(css: string): string {
  let out = css;
  for (const [from, to] of STRUCTURAL_PREFIXES) out = out.split(from).join(to);
  return out;
}

/** Vollständiges Stylesheet der Leinwand: Theme + umgeschriebene Layoutschicht. */
export function renderCanvasCss(theme: SiteTheme): string {
  return [
    renderThemeCss(theme),
    adaptPresentationCssForCanvas(renderPresentationCss(theme)),
    // Der Wrapper selbst bleibt unsichtbar; nur die Reveal-Animation der
    // Layoutschicht soll auch in der Leinwand nicht bei jedem Tastendruck
    // erneut anlaufen.
    `${WRAPPER}{display:block;}`,
    `${WRAPPER}>section,${WRAPPER}>aside{animation:none !important;}`,
  ].join('\n');
}
