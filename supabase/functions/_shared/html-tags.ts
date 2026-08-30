/**
 * Laufzeitsichere Tag-Extraktion aus fremdem HTML.
 *
 * ## Warum das eine eigene Datei ist
 *
 * Die Scanner lesen das HTML **fremder** Seiten, die ein nicht angemeldeter
 * Besucher benennt (`/audit`, `cookie-scan`). Diese Eingabe ist potenziell
 * feindselig, und bis zu 1 MB davon werden gelesen.
 *
 * Ein Ausdruck der Form `<meta[^>]*http-equiv=…>` lässt der Maschine an
 * jeder Fundstelle die Wahl, wie viel `[^>]*` frisst und wo das Literal
 * beginnt — `[^>]` matcht `h`, `t`, `p` schliesslich auch. Sie probiert
 * alle Aufteilungen durch.
 *
 * **Gemessen am 2026-08-30** auf `'<meta '.repeat(60_000)` (360 kB, kein
 * einziges `>`):
 *
 * | Ausdruck | Laufzeit |
 * |---|---|
 * | `stripPolicyDeclarations` (meta-CSP) | **8 815 ms** |
 * | `effectiveCspValue` | **9 233 ms** |
 * | `<meta\b[^>]{0,600}>` (begrenzt) | 17 322 ms für beide Pfade zusammen |
 * | dieser Durchlauf | **< 5 ms** |
 *
 * Eine Obergrenze am Quantor genügt also **nicht**: Sie deckelt nur, wie
 * teuer jede einzelne Fundstelle wird, nicht ihre Anzahl. Deshalb hier gar
 * kein Wildcard-Quantor über das Dokument, sondern ein Durchlauf mit
 * `indexOf`: Jedes Zeichen wird höchstens konstant oft betrachtet, und ein
 * Dokument ohne `>` bricht sofort ab.
 *
 * Attribute werden anschliessend auf der **isolierten, kurzen**
 * Zeichenkette gelesen (höchstens {@link MAX_TAG} Zeichen). Dort ist
 * Rückverfolgung folgenlos.
 */

/** Längstes Tag, das noch betrachtet wird. Längere gelten als nicht vorhanden. */
export const MAX_TAG = 2000;

export interface TagMatch {
  /** Index des `<` im Ausgangsdokument. */
  start: number;
  /** Index **hinter** dem `>`. */
  end: number;
  /** Das vollständige Tag, `<` bis `>`. */
  tag: string;
}

/**
 * Alle Tags eines Typs mit ihrer Position.
 *
 * Die Wortgrenze wird von Hand geprüft, damit `<a>` nicht `<article>` trifft.
 */
export function tagMatches(html: string, name: string): TagMatch[] {
  const out: TagMatch[] = [];
  if (!html) return out;
  const needle = `<${name.toLowerCase()}`;
  const hay = html.toLowerCase();
  let i = 0;
  for (;;) {
    const at = hay.indexOf(needle, i);
    if (at === -1) break;
    i = at + needle.length;
    const next = hay[i];
    if (next !== undefined && ((next >= 'a' && next <= 'z') || (next >= '0' && next <= '9') || next === '-')) continue;
    const close = hay.indexOf('>', i);
    // Kein schliessendes `>` mehr im Dokument — es folgt kein Tag mehr.
    if (close === -1) break;
    if (close - at <= MAX_TAG) out.push({ start: at, end: close + 1, tag: html.slice(at, close + 1) });
    i = close + 1;
  }
  return out;
}

/** Nur die Tags, ohne Position. */
export function tagsOf(html: string, name: string): string[] {
  return tagMatches(html, name).map((m) => m.tag);
}

/**
 * Wert eines Attributs aus einem bereits isolierten, kurzen Tag.
 *
 * Akzeptiert doppelte, einfache und fehlende Anführungszeichen. Gibt `null`
 * zurück, wenn das Attribut fehlt — nicht den leeren String, damit
 * „nicht gesetzt" und „leer gesetzt" unterscheidbar bleiben.
 */
export function attrOf(tag: string, attr: string): string | null {
  const m = tag.match(
    new RegExp(`\\b${attr}\\s{0,3}=\\s{0,3}("([^"]{0,1000})"|'([^']{0,1000})'|([^\\s>]{1,1000}))`, 'i'),
  );
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

/** Entfernt die angegebenen Bereiche aus dem Dokument — ein Durchlauf. */
export function cutRanges(html: string, ranges: Array<{ start: number; end: number }>): string {
  if (ranges.length === 0) return html;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.start < cursor) continue;
    parts.push(html.slice(cursor, r.start));
    cursor = r.end;
  }
  parts.push(html.slice(cursor));
  return parts.join('');
}
