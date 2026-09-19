/**
 * Welche Sitemap-Routen prerendert werden — eine Quelle für Skript und Tests.
 *
 * ## Warum diese Datei existiert
 *
 * Der Schwellwert stand an drei Stellen: in scripts/prerender.mjs und je einmal
 * handkopiert in test/landing/content-pages-indexable.test.ts und
 * test/landing/seo-targets-consistent.test.ts, dort jeweils mit dem Kommentar
 * „Muss zu PRIORITY_MIN in scripts/prerender.mjs passen".
 *
 * Das ist eine Bitte an den Menschen, keine Absicherung. Wer den Wert im Skript
 * ändert, lässt zwei Tests zurück, die weiter gegen den alten Wert prüfen — sie
 * werden grün bleiben und dabei die falsche Aussage treffen. Deshalb liegt der
 * Wert jetzt hier, und alle drei importieren ihn.
 *
 * prerender.mjs selbst ist nicht importierbar: es zieht Playwright auf
 * Top-Level und ruft am Dateiende `main()`. Ein Import aus einem Test würde den
 * kompletten Prerender-Lauf starten.
 *
 * ## Warum 0.5
 *
 * `priority` in public/sitemap.xml trägt hier zwei Bedeutungen: Crawl-Hinweis
 * für Suchmaschinen und Auslöser fürs Prerendering. Die Schwelle zu senken
 * lässt die Crawl-Semantik unangetastet — die Alternative wäre gewesen, 19
 * Prioritäten anzuheben und damit den Crawl-Hinweis zu verbiegen, um eine
 * Render-Entscheidung zu erzwingen.
 *
 * Bei 0.6 blieben 24 Seiten mit priority 0.5 ohne statisches HTML: sämtliche
 * kostenlosen Tools (AVV-, TOM-, Datenschutz-Generator, Klassifikator,
 * Datenpanne-Timer, Dokumente-Bundle), die regulatorischen Doorways
 * (BAIT, MaRisk, EU-AI-Act-Check, Cookie-Compliance), dazu /status, /branchen,
 * /changelog und /api-docs. Deren Meta-Tags erreichten nur Crawler, die
 * JavaScript ausführen — OG-Scraper für Social-Previews sahen die leere Hülle.
 *
 * Gemessen an CI-Lauf 35440452119: 90 Routen in rund 33 Sekunden, also etwa
 * 0,37 s pro Route bei Concurrency 4. Die 24 zusätzlichen kosten ~9 Sekunden
 * gegen ein Wall-Clock-Budget (PRERENDER_MAX_MS) von 480 Sekunden. Der Lauf
 * nutzt damit weiterhin unter 10 % seines Limits.
 *
 * ## Warum nicht 0.4
 *
 * Priority 0.4 tragen ausschliesslich Alias-Routen — /ueber-uns (canonical auf
 * /about) und /versicherungen (canonical auf /insurance). Die konsolidieren per
 * canonical auf ihr Original und brauchen kein eigenes statisches HTML. Die
 * Stufe 0.4 ist hier also eine bewusste „Alias, nicht prerendern"-Markierung
 * und keine Nachlässigkeit — sie bleibt aussen vor.
 */

/**
 * Sitemap-Einträge ab dieser `priority` werden prerendert.
 * Per Umgebungsvariable `PRERENDER_PRIORITY_MIN` überschreibbar.
 */
export const PRERENDER_PRIORITY_MIN = 0.5;

/**
 * Der effektiv geltende Schwellwert, inklusive Env-Override.
 * Ein unlesbarer Wert fällt auf die Vorgabe zurück, statt den Lauf mit NaN
 * stillschweigend jede Route verwerfen zu lassen.
 */
export function resolvePriorityMin(env = process.env) {
  const raw = env.PRERENDER_PRIORITY_MIN;
  if (raw === undefined) return PRERENDER_PRIORITY_MIN;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : PRERENDER_PRIORITY_MIN;
}
