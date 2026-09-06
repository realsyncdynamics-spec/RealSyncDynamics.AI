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

// ─────────────────────────────────────────────────────────────────────────
//  Ausgelieferte Vorschau (eigene Herkunft)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ab hier geht es um Vorschauen, die von einer **eigenen Herkunft**
 * ausgeliefert werden, statt als `srcDoc` im Dokumentbaum der Anwendung zu
 * hängen.
 *
 * Warum das die stärkere Lösung ist: Eine opake Herkunft schützt die
 * Anwendung, aber sie entsteht erst im Browser und nur solange niemand am
 * `sandbox`-Attribut dreht. Eine echte zweite Herkunft ist dagegen eine
 * Eigenschaft der Auslieferung — sie lässt sich im Frontend nicht versehentlich
 * abschalten, sie erlaubt echte HTTP-Header statt eines `<meta>`-Elements, und
 * sie ist die Voraussetzung dafür, dass eine Vorschau später über eine URL
 * teilbar wird.
 *
 * Erst mit einer eigenen Herkunft wird `allow-scripts` unbedenklich: Der
 * erzeugte Code läuft dann ohnehin fremd, unabhängig vom Sandbox-Attribut.
 *
 * Die Richtlinien stehen bewusst hier neben `previewCsp()` und nicht im
 * Worker: Es soll genau **eine** Quelle dafür geben, was eine Vorschau darf.
 * Diese Datei hat keine Imports und läuft in Browser, Node, Vitest und im
 * Workers-Runtime gleichermassen.
 */

/**
 * Wer die ausgelieferte Vorschau einbetten darf.
 *
 * Ohne diese Begrenzung könnte jede fremde Seite die Vorschau eines Kunden
 * in einen eigenen Rahmen setzen. `'none'` wäre sicherer, macht die Vorschau
 * aber unbrauchbar — die Anwendung muss sie ja zeigen.
 */
export const PREVIEW_FRAME_ANCESTORS: readonly string[] = [
  "'self'",
  'https://realsyncdynamicsai.de',
  'https://www.realsyncdynamicsai.de',
  'https://*.realsyncdynamics-ai.pages.dev',
];

/**
 * CSP für die ausgelieferte Vorschau.
 *
 * Unterschied zu `previewCsp()`: `frame-ancestors` kommt hinzu. Diese
 * Direktive wirkt **nur** als HTTP-Header und wird in einem `<meta>`-Element
 * ignoriert — sie ist einer der Gründe, warum die eigene Herkunft mehr kann
 * als die eingebettete Variante.
 */
export function servedPreviewCsp(isolation: PreviewIsolation): string {
  return `${previewCsp(isolation)}; frame-ancestors ${PREVIEW_FRAME_ANCESTORS.join(' ')}`;
}

/**
 * Vollständiger Header-Satz für eine ausgelieferte Vorschau.
 *
 * `Cache-Control: no-store` ist Absicht: Ein Entwurf ist unveröffentlichter
 * Inhalt eines Besuchers. Er gehört weder in einen geteilten Zwischenspeicher
 * noch in den Verlauf eines Zwischenrechners.
 */
export function servedPreviewHeaders(isolation: PreviewIsolation): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': servedPreviewCsp(isolation),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    // Gerätezugriffe, die eine Gestaltungsvorschau nie braucht.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    'Cache-Control': 'no-store, max-age=0',
    // Verhindert, dass eine Vorschau in den Suchindex gerät.
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

/**
 * Kennung einer Vorschau.
 *
 * Anonyme Entwürfe sind **nicht** auflistbar und hängen an keinem Mandanten —
 * die Kennung ist der einzige Zugangsschutz. Sie muss deshalb aus einem
 * kryptographischen Zufallsgenerator stammen, nicht aus einem Zähler und nicht
 * aus einem Zeitstempel.
 *
 * 128 Bit als 32 Hex-Zeichen. Die Prüfung ist absichtlich streng: Sie läuft
 * vor jedem Speicherzugriff und hält Pfad-Manipulationen von der Ablage fern.
 */
export const PREVIEW_ID_PATTERN = /^[0-9a-f]{32}$/;

export function isPreviewId(value: string | null | undefined): boolean {
  return typeof value === 'string' && PREVIEW_ID_PATTERN.test(value);
}

/**
 * Erzeugt eine Vorschau-Kennung aus `crypto.getRandomValues`.
 *
 * Nimmt den Generator als Argument, damit dieselbe Funktion im Browser, im
 * Workers-Runtime und im Test läuft — und damit ein Test beweisen kann, dass
 * wirklich der übergebene Generator benutzt wird.
 */
export function createPreviewId(getRandomValues: (array: Uint8Array) => Uint8Array): string {
  const bytes = getRandomValues(new Uint8Array(16));
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * Lebensdauer eines anonymen Entwurfs in Sekunden.
 *
 * Ein Entwurf ohne Konto ist Inhalt, den jemand hinterlassen hat, ohne in eine
 * Speicherung einzuwilligen. Er verfällt deshalb von selbst — das ist die
 * Antwort auf DSGVO Art. 5 Abs. 1 lit. e (Speicherbegrenzung) und zugleich
 * die Obergrenze dafür, wie lange eine nicht übernommene Vorschau erreichbar
 * bleibt. Beim Project Claim wandert der Entwurf in den Mandanten und
 * unterliegt dann dessen Aufbewahrungsregeln.
 */
export const ANONYMOUS_PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Kleinste Lebensdauer, die eine abgelegte Vorschau haben darf.
 *
 * Cloudflare KV lehnt `expirationTtl` unter 60 Sekunden ab. Der Wert steht
 * hier und nicht im Worker, weil der Schreibpfad ihn kennen muss, bevor er
 * schreibt: Eine Sitzung, deren Rest darunter liegt, ist praktisch abgelaufen
 * — dann wird gar nichts erst abgelegt, statt in einen Fehler der Ablage zu
 * laufen, dessen Ursache dort niemand mehr sieht.
 */
export const MIN_PREVIEW_TTL_SECONDS = 60;

/**
 * Obergrenze für ein abgelegtes Vorschau-Dokument in Bytes.
 *
 * Gemessen wird der **gesamte** Eintrag, nicht nur die Startseite: Eine
 * Vorschau trägt seit der Mehrseiten-Ablage alle Unterseiten mit sich, und
 * eine Grenze, die nur das erste Feld prüft, ist keine Grenze.
 *
 * Eine erzeugte Website liegt weit darunter — der Wert schützt die Ablage,
 * nicht den Kunden vor sich selbst.
 */
export const ANONYMOUS_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
