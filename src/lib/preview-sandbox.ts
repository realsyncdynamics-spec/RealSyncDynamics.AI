/**
 * Isolierung für Vorschau-Rahmen.
 *
 * ── Warum es diese Datei gibt ────────────────────────────────────────────
 *
 * Eine Vorschau zeigt Code, den nicht wir geschrieben haben — erzeugt aus
 * der Beschreibung oder den Inhalten eines Kunden. Sie läuft heute als
 * `srcDoc` in einem Rahmen innerhalb der Anwendung. Das Attribut `sandbox`
 * entscheidet, was dieser Code darf.
 *
 * Die gefährliche Kombination ist `allow-scripts` **zusammen mit**
 * `allow-same-origin`: Ein `srcDoc`-Dokument erbt dann die Herkunft der
 * Anwendung. Sein JavaScript läuft in unserer Herkunft und erreicht deren
 * `localStorage` — dort liegt die Supabase-Sitzung. Erzeugter Code könnte
 * fremde Sitzungen auslesen.
 *
 * Genau diese Kombination verhindert `sandboxTokens()` — nicht als Hinweis,
 * sondern indem sie unerreichbar ist: Wer Skripte erlaubt, bekommt eine
 * **opake Herkunft**. Das Dokument läuft dann in einer eigenen, zufälligen
 * Herkunft und ist gegenüber der Anwendung fremd, obwohl es aus `srcDoc`
 * stammt.
 *
 * ── Was diese Datei NICHT ersetzt ────────────────────────────────────────
 *
 * Eine eigene Herkunft (eigene Subdomain je Vorschau) bleibt die stärkere
 * Lösung und wird gebraucht, sobald Vorschauen über eine URL teilbar werden
 * — eine opake Herkunft schützt die Anwendung, aber die Vorschau liegt
 * weiterhin im selben Dokumentbaum. Siehe `docs/product/siteos-anonymous-build.md` §3.
 */

/**
 * Was die Vorschau ausführen darf.
 *
 * `static`      — kein JavaScript. Der heutige Stand: `siteos-core` erzeugt
 *                 vollständig eigenständiges HTML, dessen einziges
 *                 `<script>` ein `application/ld+json`-Block ist und damit
 *                 nicht ausgeführt wird.
 * `interactive` — JavaScript läuft, aber in opaker Herkunft. Für Vorschauen
 *                 mit echten Komponenten, Formularen und Animationen.
 */
export type PreviewIsolation = 'static' | 'interactive';

/**
 * Die `sandbox`-Marken für den Rahmen.
 *
 * Bewusst wird bei `static` **kein** `allow-same-origin` gesetzt, obwohl es
 * im Bestand stand: Ohne Skripte bringt es keinen Nutzen, gibt dem Dokument
 * aber unsere Herkunft. Weglassen kostet nichts und nimmt der späteren
 * Ergänzung von `allow-scripts` ihre Gefährlichkeit.
 *
 * Ein leerer String bedeutet: alles gesperrt. Das ist kein Versehen, sondern
 * die strengste Stufe.
 */
export function sandboxTokens(isolation: PreviewIsolation): string {
  // Es gibt hier absichtlich keinen Parameter, mit dem sich
  // `allow-same-origin` zuschalten liesse. Ein solcher Schalter wäre die
  // eine Stellschraube, an der jemand unter Zeitdruck dreht.
  return isolation === 'interactive' ? 'allow-scripts allow-forms allow-popups' : '';
}

/** Marken, die nie gemeinsam auftreten dürfen. */
export const FORBIDDEN_SANDBOX_PAIR = ['allow-scripts', 'allow-same-origin'] as const;

/**
 * Prüft eine `sandbox`-Zeichenkette auf die verbotene Kombination.
 *
 * Existiert, damit ein Test jeden Rahmen im Repository prüfen kann — auch
 * solche, die ihre Marken nicht über `sandboxTokens()` beziehen.
 */
export function hasForbiddenSandboxCombination(tokens: string): boolean {
  const set = new Set(tokens.split(/\s+/).filter(Boolean));
  return FORBIDDEN_SANDBOX_PAIR.every((token) => set.has(token));
}

/**
 * Content-Security-Policy für das Vorschau-Dokument.
 *
 * Zugeschnitten auf das, was `siteos-core` tatsächlich erzeugt: Stile stehen
 * inline in einem `<style>`-Block (`renderThemeCss`), Bilder sind
 * Platzhalter ohne `src`, es gibt keine externen Schriften und kein externes
 * CSS. Deshalb ist `default-src 'none'` möglich — die strengste Grundlage,
 * von der aus nur das Nötige geöffnet wird.
 *
 * `form-action 'none'` verhindert, dass ein erzeugtes Formular Eingaben an
 * ein fremdes Ziel sendet. In einer Vorschau soll nichts abgeschickt werden.
 */
export function previewCsp(isolation: PreviewIsolation): string {
  const directives = [
    "default-src 'none'",
    // Die Gestaltung kommt als eingebettetes <style> — ohne 'unsafe-inline'
    // wäre die Vorschau ungestylt und damit wertlos. Vertretbar, weil das
    // Dokument in opaker Herkunft läuft und nichts nachladen darf.
    "style-src 'unsafe-inline'",
    "img-src data:",
    "font-src 'none'",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ];
  // Auch im interaktiven Fall bleibt nur eingebettetes Skript erlaubt:
  // Nachladen von fremdem Code ist nie Teil einer Vorschau.
  directives.push(isolation === 'interactive' ? "script-src 'unsafe-inline'" : "script-src 'none'");
  return directives.join('; ');
}

/**
 * Setzt die CSP als `<meta>` in das Vorschau-Dokument.
 *
 * Über HTTP-Header wäre sie verbindlicher, aber `srcDoc` kennt keine Header.
 * Solange die Vorschau nicht von einer eigenen Herkunft ausgeliefert wird,
 * ist das `<meta>`-Element der einzige Weg — und es wirkt, sofern es vor dem
 * ersten Inhalt steht. Deshalb wird direkt hinter `<head>` eingesetzt.
 *
 * Fehlt ein `<head>`, wird die Richtlinie **nicht** stillschweigend
 * weggelassen, sondern ein Kopf erzeugt. Ein Dokument ohne CSP wäre genau
 * der Fall, den diese Datei verhindern soll.
 */
export function withPreviewCsp(html: string, isolation: PreviewIsolation): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${previewCsp(isolation)}">`;
  const headOpen = /<head(\s[^>]*)?>/i;
  if (headOpen.test(html)) return html.replace(headOpen, (match) => `${match}${meta}`);

  const htmlOpen = /<html(\s[^>]*)?>/i;
  if (htmlOpen.test(html)) return html.replace(htmlOpen, (match) => `${match}<head>${meta}</head>`);

  return `${meta}${html}`;
}
