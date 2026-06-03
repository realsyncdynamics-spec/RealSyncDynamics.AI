/**
 * Scan-Coverage-Bewertung für den DSGVO-Audit-Scanner.
 *
 * Hintergrund (False-Negative-Risiko bei SPAs):
 * Der `gdpr-audit`-Scanner macht einen statischen Server-Fetch — er sieht
 * NUR das ausgelieferte HTML, kein JavaScript-Rendering. Bei rein
 * client-gerenderten Single-Page-Apps (Vite/CRA/Next-CSR) liefert der
 * Server bloß ein leeres Grundgerüst (`<div id="root"></div>` + Bundle).
 * Tracker, Consent-Banner und Pflicht-Links werden dann erst per JS
 * nachgeladen und sind im statischen Scan unsichtbar.
 *
 * Folge: Der Scan kann auf einer solchen Shell weder zuverlässig Befunde
 * erkennen (False Negatives → trügerische Entwarnung) noch ein belastbares
 * Urteil fällen. Statt selbstbewusst einen Score zu präsentieren, soll die
 * Engine ehrlich „Reichweite eingeschränkt" melden.
 *
 * `assessScanCoverage` klassifiziert konservativ:
 *   - 'failed'  : Fetch schlug fehl / kein Status (Site nicht erreichbar)
 *   - 'limited' : HTML vorhanden, aber (a) HTTP-Fehlerseite, oder
 *                 (b) JS-App-Shell mit kaum sichtbarem Inhalt
 *   - 'full'    : server-gerendertes / prerendered HTML mit echtem Inhalt
 *
 * Bewusst konservativ kalibriert: Eine prerendered/SSG-Seite (viel sichtbarer
 * Text + echte Navigation) gilt als 'full', AUCH wenn sie technisch eine SPA
 * mit Root-Mount + Module-Bundle ist. Nur eine quasi inhaltsleere Shell wird
 * als 'limited' markiert.
 *
 * Die Funktion ist pure (kein Fetch, kein Network) — direkt aus der
 * Edge-Function aufrufbar und unter Vitest testbar (analog zu
 * `jurisdiction.ts` / `tracker-detection.ts`).
 */

export type ScanCoverage = 'full' | 'limited' | 'failed';

export interface CoverageAssessment {
  coverage: ScanCoverage;
  /** Maschinen-lesbarer Grund, null bei 'full'. */
  reason: string | null;
  /** Kurzer, nutzerfreundlicher Hinweistext (DE), null bei 'full'. */
  notice: string | null;
}

// Schwellwerte — konservativ, damit prerendered Seiten 'full' bleiben.
const MIN_VISIBLE_TEXT = 500; // Zeichen sichtbaren Texts
const MIN_ANCHORS = 5;        // gerenderte <a href>-Navigationselemente

/**
 * Extrahiert groben sichtbaren Text: entfernt head/script/style/noscript
 * und alle Tags. Reicht für eine Größenordnungs-Heuristik (kein DOM nötig).
 */
export function visibleTextLength(html: string): number {
  const text = html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length;
}

export function assessScanCoverage(
  html: string,
  status: number | null,
  fetchError: string | null,
): CoverageAssessment {
  if (fetchError || status === null) {
    return {
      coverage: 'failed',
      reason: 'fetch_failed',
      notice: 'Die Seite konnte nicht geladen werden — es liegt kein belastbares Scan-Ergebnis vor.',
    };
  }

  if (status >= 400) {
    return {
      coverage: 'limited',
      reason: `http_${status}`,
      notice: `Die Seite lieferte HTTP ${status}. Der Scan basiert auf einer Fehlerseite und ist nicht repräsentativ.`,
    };
  }

  const textLen = visibleTextLength(html);
  const anchorCount = (html.match(/<a\s[^>]*href=/gi) ?? []).length;
  const hasRootMount = /<div[^>]+id=["'](?:root|app|__next|__nuxt|q-app)["']/i.test(html);
  const hasModuleBundle = /<script[^>]+type=["']module["'][^>]+src=/i.test(html);
  const hasEnableJsNotice =
    /enable\s+javascript|requires?\s+javascript|aktiviere?\s+javascript|benötigt\s+javascript/i.test(html);

  const looksLikeJsApp = hasRootMount || hasModuleBundle || hasEnableJsNotice;
  const contentSparse = textLen < MIN_VISIBLE_TEXT && anchorCount < MIN_ANCHORS;

  if (looksLikeJsApp && contentSparse) {
    return {
      coverage: 'limited',
      reason: 'client_rendered_shell',
      notice:
        'Diese Seite wird client-seitig gerendert — der statische Scan sieht nur das Grundgerüst. ' +
        'Tracker, Consent-Banner und Pflicht-Links, die per JavaScript nachgeladen werden, können ' +
        'nicht erfasst werden. Für ein belastbares Ergebnis ist ein Render-Scan nötig.',
    };
  }

  return { coverage: 'full', reason: null, notice: null };
}
