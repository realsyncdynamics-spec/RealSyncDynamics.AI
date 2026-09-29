// HTML-Hilfen für den Import — ohne DOM, ohne Abhängigkeiten.
//
// Der Kern läuft in Deno, Node und im Browser. Ein DOM-Parser ist in zwei
// der drei Laufzeiten nicht vorhanden, und `analysis/observation.ts` arbeitet
// aus demselben Grund mit regulären Ausdrücken. Diese Datei bündelt die
// Muster, damit `extract.ts` lesbar bleibt.
//
// Grenzen, die man kennen muss: Kein JavaScript wird ausgeführt. Was eine
// SPA erst im Browser rendert, sieht der Import nicht — das Ergebnis sagt
// das dann über `wordCount` und die Befunde, statt es zu verschweigen.

export interface Tag {
  /** Der vollständige Fund inkl. öffnendem und schließendem Tag. */
  full: string;
  /** Rohtext der Attribute des öffnenden Tags. */
  attrs: string;
  /** Inhalt zwischen den Tags; leer bei Void-Elementen. */
  inner: string;
  /** Position im Dokument — für „steht das im oberen Drittel?". */
  index: number;
}

const VOID_TAGS = new Set(['img', 'input', 'meta', 'link', 'br', 'hr', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed', 'param']);

/**
 * Findet alle Vorkommen eines Elements. Für Void-Elemente nur das öffnende
 * Tag; sonst bis zum nächsten passenden schließenden Tag (nicht verschachtelt
 * — für `a`, `button`, `form`, `p`, `h1` genügt das, für `div` wäre es falsch,
 * deshalb wird `div` hier nie abgefragt).
 */
export function findTags(html: string, name: string, limit = 500): Tag[] {
  const out: Tag[] = [];
  const isVoid = VOID_TAGS.has(name);
  const pattern = isVoid
    ? new RegExp(`<${name}\\b([^>]*)>`, 'gi')
    : new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}\\s*>`, 'gi');
  for (const match of html.matchAll(pattern)) {
    out.push({ full: match[0], attrs: match[1] ?? '', inner: isVoid ? '' : (match[2] ?? ''), index: match.index ?? 0 });
    if (out.length >= limit) break;
  }
  return out;
}

/** Liest ein Attribut aus einem Attribut-Rohtext. Gibt `null` zurück, wenn es fehlt. */
export function getAttr(attrs: string, name: string): string | null {
  const quoted = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  if (quoted) return decodeEntities(quoted[1] ?? quoted[2] ?? '').trim();
  const bare = new RegExp(`(?:^|\\s)${name}\\s*=\\s*([^\\s"'>]+)`, 'i').exec(attrs);
  if (bare) return decodeEntities(bare[1] ?? '').trim();
  const present = new RegExp(`(?:^|\\s)${name}(?=\\s|$)`, 'i').test(attrs);
  return present ? '' : null;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const n = parseInt(code, 16);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    });
}

/** Entfernt Tags, dekodiert Entities, normalisiert Leerraum. */
export function cleanText(value: string | null | undefined): string {
  if (!value) return '';
  return decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Dokument ohne Skripte, Styles, Kommentare und `noscript` — die Grundlage für sichtbaren Text. */
export function stripNonVisible(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[\s\S]*?<\/head\s*>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template\s*>/gi, ' ');
}

/** Navigation und Kopfbereich entfernt — für Textanalysen, die Menüpunkte nicht als Sätze lesen sollen. */
export function withoutChrome(html: string): string {
  return html.replace(/<nav\b[\s\S]*?<\/nav\s*>/gi, ' ').replace(/<header\b[\s\S]*?<\/header\s*>/gi, ' ');
}

/** Sichtbarer Text des Dokuments. Blockelemente werden zu Satzgrenzen. */
export function visibleText(html: string): string {
  const withBreaks = stripNonVisible(html).replace(
    /<\/(?:p|div|section|article|li|h[1-6]|tr|td|th|blockquote|figcaption|footer|header|nav|main|aside|dd|dt)\s*>|<br\s*\/?>/gi,
    ' . ',
  );
  return cleanText(withBreaks).replace(/(?:\s*\.\s*){2,}/g, '. ').trim();
}

/** Meta-Inhalt über `name` oder `property`. */
export function metaContent(html: string, key: string): string | null {
  for (const tag of findTags(html, 'meta', 300)) {
    const name = getAttr(tag.attrs, 'name') ?? getAttr(tag.attrs, 'property');
    if (name && name.toLowerCase() === key.toLowerCase()) {
      const content = getAttr(tag.attrs, 'content');
      return content ? content : null;
    }
  }
  return null;
}

/** `<link rel="…" href="…">`-Ziele für ein rel. */
export function linkHrefs(html: string, rel: string): string[] {
  const out: string[] = [];
  for (const tag of findTags(html, 'link', 300)) {
    const rels = (getAttr(tag.attrs, 'rel') ?? '').toLowerCase().split(/\s+/);
    if (!rels.includes(rel.toLowerCase())) continue;
    const href = getAttr(tag.attrs, 'href');
    if (href) out.push(href);
  }
  return out;
}

/** Löst eine Referenz gegen die Basis-URL auf; `null`, wenn sie unbrauchbar ist. */
export function resolveUrl(href: string, base: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || /^(?:javascript|data|vbscript):/i.test(trimmed)) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Gehören zwei Hosts zur selben Site? Vergleicht die letzten beiden Labels
 * (`www.beispiel.de` ↔ `beispiel.de`). Für zweistufige Endungen (`co.uk`)
 * bewusst grob — ein falsch als extern eingestufter Subhost ist ein
 * harmloser Befund, ein falsch als intern eingestufter Tracker nicht.
 */
export function sameSite(a: string, b: string): boolean {
  const tail = (host: string) => host.split('.').slice(-2).join('.');
  return tail(a) === tail(b);
}

/** Kürzt auf `max` Zeichen und markiert die Kürzung. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function unique<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const value of values) {
    const k = key(value);
    if (!seen.has(k)) seen.set(k, value);
  }
  return [...seen.values()];
}

/** Sätze aus Fließtext — für Lesbarkeit und Trust-Auszüge. `·` und `|` trennen wie Satzenden. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9„"])|\s\.\s|\s[·|]\s/u)
    .map((s) => s.replace(/^[.\s]+|[.\s]+$/g, '').trim())
    .filter((s) => s.length >= 3);
}

export function wordCount(text: string): number {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}
