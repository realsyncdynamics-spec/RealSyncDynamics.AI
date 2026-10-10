// Toleranter HTML-Leser für die Extraktion.
//
// ## Warum ein eigener Leser
//
// Der Kern läuft in Deno ohne DOM, und er darf keine Abhängigkeit haben
// (siehe README des Pakets). `analysis/observation.ts` kommt für seine
// wenigen Signale mit Regex aus. Die Extraktion braucht mehr: „der erste
// Absatz nach der H1 im selben Abschnitt", „die Beschriftung zu diesem
// Eingabefeld", „die Links in der ersten Navigation". Das sind Fragen an
// eine Baumstruktur, nicht an eine Zeichenkette.
//
// ## Warum ohne Regex über das Dokument
//
// Das Dokument kommt von einer fremden Website und ist damit feindliche
// Eingabe. Ein Regex mit Rückverfolgung über ein Megabyte HTML ist die
// klassische ReDoS-Stelle (vgl. CodeQL-Befund in `slugify`). Dieser Leser
// läuft deshalb in einer einzigen Vorwärtsbewegung über den Text: jede
// Position wird eine konstante Zahl von Malen angefasst. Grenzen für Tiefe
// und Knotenzahl kappen pathologische Dokumente, statt an ihnen zu hängen.
//
// ## Was er nicht ist
//
// Kein vollständiger HTML5-Parser. Er kennt leere Elemente, Rohtext-Elemente
// (script, style, textarea, title) und die häufigsten impliziten Endtags
// (p, li, dt/dd, option, tr/td). Für die Fragen der Extraktion genügt das;
// wo er ein kaputtes Dokument anders liest als ein Browser, liefert die
// Extraktion im Zweifel „unbekannt" statt eines falschen Werts.

export interface HtmlElement {
  type: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
  parent: HtmlElement | null;
  /** Offset des `<` im Quelltext. */
  start: number;
  /** Offset hinter dem schließenden `>` des Starttags. */
  openEnd: number;
  /** Offset hinter dem Endtag (oder dem Starttag bei leeren/ungeschlossenen Elementen). */
  end: number;
}

export interface HtmlText {
  type: 'text';
  text: string;
  parent: HtmlElement;
  start: number;
}

export type HtmlNode = HtmlElement | HtmlText;

export interface HtmlDocument {
  root: HtmlElement;
  source: string;
  nodeCount: number;
  /** Wurde das Lesen wegen einer Grenze abgebrochen? */
  truncated: boolean;
}

export interface ParseLimits {
  maxNodes?: number;
  maxDepth?: number;
}

const DEFAULT_MAX_NODES = 80_000;
const DEFAULT_MAX_DEPTH = 256;

const VOID_TAGS: ReadonlySet<string> = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

/** Inhalt wird bis zum passenden Endtag als Text gelesen, nicht als Markup. */
const RAW_TEXT_TAGS: ReadonlySet<string> = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'template', 'xmp']);

/** Blockelemente, die ein offenes <p> implizit schließen. */
const CLOSES_P: ReadonlySet<string> = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'menu', 'nav', 'ol',
  'p', 'pre', 'section', 'table', 'ul',
]);

// ─────────────────────────────────────────────────────────────────────
// Entitäten
// ─────────────────────────────────────────────────────────────────────

const NAMED_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', agrave: 'à', aacute: 'á', ccedil: 'ç', ntilde: 'ñ',
  euro: '€', copy: '©', reg: '®', trade: '™', deg: '°', sect: '§', para: '¶',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
  bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', sbquo: '‚',
  laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›', times: '×', shy: '',
  zwj: '', zwnj: '', thinsp: ' ', ensp: ' ', emsp: ' ',
});

/**
 * Löst benannte und numerische Entitäten auf. Unbekannte bleiben stehen —
 * lieber ein sichtbares `&foo;` als ein geratenes Zeichen.
 */
export function decodeEntities(input: string): string {
  if (input.indexOf('&') === -1) return input;
  let out = '';
  let i = 0;
  while (i < input.length) {
    const amp = input.indexOf('&', i);
    if (amp === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, amp);
    // Das Semikolon nur in Reichweite eines Entitätsnamens suchen (höchstens
    // 12 Zeichen). Ein `indexOf` bis zum Ende liefe bei vielen `&` ohne `;`
    // für jedes einzelne über das ganze Dokument — quadratisch.
    let semi = -1;
    const limit = Math.min(input.length, amp + 13);
    for (let j = amp + 1; j < limit; j += 1) {
      if (input.charCodeAt(j) === 59) {
        semi = j;
        break;
      }
    }
    if (semi === -1) {
      out += '&';
      i = amp + 1;
      continue;
    }
    const body = input.slice(amp + 1, semi);
    let decoded: string | null = null;
    if (body.startsWith('#x') || body.startsWith('#X')) {
      decoded = fromCodePoint(parseInt(body.slice(2), 16));
    } else if (body.startsWith('#')) {
      decoded = fromCodePoint(parseInt(body.slice(1), 10));
    } else if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body)) {
      decoded = NAMED_ENTITIES[body];
    }
    if (decoded === null) {
      out += '&';
      i = amp + 1;
    } else {
      out += decoded;
      i = semi + 1;
    }
  }
  return out;
}

function fromCodePoint(cp: number): string | null {
  if (!Number.isInteger(cp) || cp <= 0 || cp > 0x10ffff) return null;
  if (cp >= 0xd800 && cp <= 0xdfff) return null;
  return String.fromCodePoint(cp);
}

// ─────────────────────────────────────────────────────────────────────
// Lesen
// ─────────────────────────────────────────────────────────────────────

function isTagNameStart(char: string | undefined): boolean {
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isTagNameChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || char === '-' || char === ':' || char === '_';
}

function isSpace(char: string | undefined): boolean {
  return char === ' ' || char === '\n' || char === '\t' || char === '\r' || char === '\f';
}

/**
 * Liest ein Dokument in eine Baumstruktur. Wirft nie: Ein kaputtes Dokument
 * ergibt einen unvollständigen Baum, kein Fehler.
 */
export function parseHtml(source: string, limits: ParseLimits = {}): HtmlDocument {
  const maxNodes = limits.maxNodes ?? DEFAULT_MAX_NODES;
  const maxDepth = limits.maxDepth ?? DEFAULT_MAX_DEPTH;
  const n = source.length;

  const root: HtmlElement = { type: 'element', tag: '#root', attrs: {}, children: [], parent: null, start: 0, openEnd: 0, end: n };
  const stack: HtmlElement[] = [root];
  let nodeCount = 0;
  let truncated = false;

  const current = (): HtmlElement => stack[stack.length - 1];

  const addText = (from: number, to: number): void => {
    if (to <= from) return;
    const raw = source.slice(from, to);
    // Reiner Leerraum trägt für die Extraktion nichts bei.
    let blank = true;
    for (let k = 0; k < raw.length; k += 1) {
      if (!isSpace(raw[k]) && raw[k] !== ' ') { blank = false; break; }
    }
    if (blank) return;
    nodeCount += 1;
    current().children.push({ type: 'text', text: decodeEntities(raw), parent: current(), start: from });
  };

  /** Schließt Elemente bis einschließlich des obersten mit `tag`, begrenzt durch `boundary`. */
  const closeUpTo = (tags: ReadonlySet<string>, boundary: ReadonlySet<string>, at: number): void => {
    for (let k = stack.length - 1; k > 0; k -= 1) {
      const el = stack[k];
      if (boundary.has(el.tag)) return;
      if (tags.has(el.tag)) {
        for (let m = stack.length - 1; m >= k; m -= 1) stack[m].end = at;
        stack.length = k;
        return;
      }
    }
  };

  const applyImpliedEnds = (tag: string, at: number): void => {
    if (CLOSES_P.has(tag)) closeUpTo(P_SET, BUTTON_BOUNDARY, at);
    if (tag === 'li') closeUpTo(LI_SET, LIST_BOUNDARY, at);
    else if (tag === 'dt' || tag === 'dd') closeUpTo(DTDD_SET, DL_BOUNDARY, at);
    else if (tag === 'option') closeUpTo(OPTION_SET, SELECT_BOUNDARY, at);
    else if (tag === 'tr') closeUpTo(TR_SET, TABLE_BOUNDARY, at);
    else if (tag === 'td' || tag === 'th') closeUpTo(CELL_SET, ROW_BOUNDARY, at);
    else if (tag === 'a') closeUpTo(A_SET, EMPTY_SET, at);
  };

  let i = 0;
  while (i < n) {
    if (nodeCount >= maxNodes) {
      truncated = true;
      break;
    }
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      addText(i, n);
      break;
    }
    if (lt > i) addText(i, lt);

    const next = source[lt + 1];

    // Kommentar
    if (next === '!' && source.startsWith('<!--', lt)) {
      const close = source.indexOf('-->', lt + 4);
      i = close === -1 ? n : close + 3;
      continue;
    }
    // Doctype, CDATA, Verarbeitungsanweisung
    if (next === '!' || next === '?') {
      const gt = source.indexOf('>', lt + 2);
      i = gt === -1 ? n : gt + 1;
      continue;
    }

    // Endtag
    if (next === '/') {
      let j = lt + 2;
      let name = '';
      while (j < n && isTagNameChar(source[j])) {
        name += source[j];
        j += 1;
      }
      const gt = source.indexOf('>', j);
      i = gt === -1 ? n : gt + 1;
      name = name.toLowerCase();
      if (name === '') continue;
      for (let k = stack.length - 1; k > 0; k -= 1) {
        if (stack[k].tag === name) {
          for (let m = stack.length - 1; m >= k; m -= 1) stack[m].end = i;
          stack.length = k;
          break;
        }
      }
      continue;
    }

    // Ein `<` ohne Tagnamen ist Text.
    if (!isTagNameStart(next)) {
      addText(lt, lt + 1);
      i = lt + 1;
      continue;
    }

    // Starttag
    let j = lt + 1;
    let name = '';
    while (j < n && isTagNameChar(source[j])) {
      name += source[j];
      j += 1;
    }
    const tag = name.toLowerCase();
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    let openEnd = n;

    while (j < n) {
      while (j < n && isSpace(source[j])) j += 1;
      if (j >= n) break;
      const c = source[j];
      if (c === '>') {
        openEnd = j + 1;
        break;
      }
      if (c === '/') {
        if (source[j + 1] === '>') {
          selfClosing = true;
          openEnd = j + 2;
          break;
        }
        j += 1;
        continue;
      }
      // Attributname
      let attrName = '';
      while (j < n) {
        const ch = source[j];
        if (isSpace(ch) || ch === '=' || ch === '>' || ch === '"' || ch === "'" || (ch === '/' && source[j + 1] === '>')) break;
        attrName += ch;
        j += 1;
      }
      if (attrName === '') {
        // Unerwartetes Zeichen (z. B. ein verirrtes Anführungszeichen): überspringen.
        j += 1;
        continue;
      }
      while (j < n && isSpace(source[j])) j += 1;
      let value = '';
      if (source[j] === '=') {
        j += 1;
        while (j < n && isSpace(source[j])) j += 1;
        const quote = source[j];
        if (quote === '"' || quote === "'") {
          const closeQuote = source.indexOf(quote, j + 1);
          const stop = closeQuote === -1 ? n : closeQuote;
          value = source.slice(j + 1, stop);
          j = closeQuote === -1 ? n : closeQuote + 1;
        } else {
          const from = j;
          while (j < n && !isSpace(source[j]) && source[j] !== '>') j += 1;
          value = source.slice(from, j);
        }
      }
      const key = attrName.toLowerCase();
      // Erstes Vorkommen gewinnt (HTML-Spezifikation).
      if (!Object.prototype.hasOwnProperty.call(attrs, key)) attrs[key] = decodeEntities(value);
    }
    i = openEnd;

    applyImpliedEnds(tag, lt);

    const parent = current();
    const element: HtmlElement = { type: 'element', tag, attrs, children: [], parent, start: lt, openEnd, end: openEnd };
    nodeCount += 1;
    parent.children.push(element);

    if (VOID_TAGS.has(tag) || selfClosing) continue;

    if (RAW_TEXT_TAGS.has(tag)) {
      const close = findRawClose(source, tag, openEnd);
      const textEnd = close === -1 ? n : close;
      const raw = source.slice(openEnd, textEnd);
      if (raw.length > 0) {
        nodeCount += 1;
        const decode = tag === 'title' || tag === 'textarea';
        element.children.push({ type: 'text', text: decode ? decodeEntities(raw) : raw, parent: element, start: openEnd });
      }
      if (close === -1) {
        element.end = n;
        i = n;
      } else {
        const gt = source.indexOf('>', close);
        element.end = gt === -1 ? n : gt + 1;
        i = element.end;
      }
      continue;
    }

    if (stack.length >= maxDepth) {
      // Zu tief verschachtelt: Das Element bleibt ein Blatt, sein Inhalt
      // landet beim Elternteil. Kein Abbruch, keine Rekursion.
      truncated = true;
      continue;
    }
    stack.push(element);
  }

  // Was bis zum Ende offen blieb, reicht bis zum Ende des Dokuments.
  for (let k = stack.length - 1; k > 0; k -= 1) stack[k].end = n;

  return { root, source, nodeCount, truncated };
}

const P_SET: ReadonlySet<string> = new Set(['p']);
const LI_SET: ReadonlySet<string> = new Set(['li']);
const DTDD_SET: ReadonlySet<string> = new Set(['dt', 'dd']);
const OPTION_SET: ReadonlySet<string> = new Set(['option']);
const TR_SET: ReadonlySet<string> = new Set(['tr']);
const CELL_SET: ReadonlySet<string> = new Set(['td', 'th']);
const A_SET: ReadonlySet<string> = new Set(['a']);
const EMPTY_SET: ReadonlySet<string> = new Set();
const BUTTON_BOUNDARY: ReadonlySet<string> = new Set(['button', 'table', 'td', 'th']);
const LIST_BOUNDARY: ReadonlySet<string> = new Set(['ul', 'ol', 'menu']);
const DL_BOUNDARY: ReadonlySet<string> = new Set(['dl']);
const SELECT_BOUNDARY: ReadonlySet<string> = new Set(['select', 'datalist']);
const TABLE_BOUNDARY: ReadonlySet<string> = new Set(['table', 'tbody', 'thead', 'tfoot']);
const ROW_BOUNDARY: ReadonlySet<string> = new Set(['tr', 'table']);

/** Sucht `</tag` ohne Rücksicht auf Groß-/Kleinschreibung. */
function findRawClose(source: string, tag: string, from: number): number {
  let at = from;
  while (at < source.length) {
    const candidate = source.indexOf('</', at);
    if (candidate === -1) return -1;
    if (source.slice(candidate + 2, candidate + 2 + tag.length).toLowerCase() === tag) {
      const after = source[candidate + 2 + tag.length];
      if (after === undefined || after === '>' || isSpace(after) || after === '/') return candidate;
    }
    at = candidate + 2;
  }
  return -1;
}

// ─────────────────────────────────────────────────────────────────────
// Navigation im Baum
// ─────────────────────────────────────────────────────────────────────

/** Elemente, deren Text nie zum sichtbaren Inhalt gehört. */
const INVISIBLE_TEXT: ReadonlySet<string> = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head']);

/** Besucht alle Elemente in Dokumentreihenfolge (iterativ, ohne Rekursion). */
export function walkElements(root: HtmlElement, visit: (el: HtmlElement) => void | 'skip'): void {
  const pending: HtmlElement[] = [root];
  while (pending.length > 0) {
    const el = pending.pop() as HtmlElement;
    if (el !== root && visit(el) === 'skip') continue;
    for (let k = el.children.length - 1; k >= 0; k -= 1) {
      const child = el.children[k];
      if (child.type === 'element') pending.push(child);
    }
  }
}

export function findAll(root: HtmlElement, predicate: (el: HtmlElement) => boolean): HtmlElement[] {
  const out: HtmlElement[] = [];
  walkElements(root, (el) => {
    if (predicate(el)) out.push(el);
  });
  return out;
}

export function findFirst(root: HtmlElement, predicate: (el: HtmlElement) => boolean): HtmlElement | null {
  let found: HtmlElement | null = null;
  walkElements(root, (el) => {
    if (found) return 'skip';
    if (predicate(el)) {
      found = el;
      return 'skip';
    }
    return undefined;
  });
  return found;
}

export function byTag(...tags: string[]): (el: HtmlElement) => boolean {
  const set = new Set(tags);
  return (el) => set.has(el.tag);
}

export function closest(el: HtmlElement, predicate: (el: HtmlElement) => boolean): HtmlElement | null {
  let cursor: HtmlElement | null = el.parent;
  while (cursor && cursor.tag !== '#root') {
    if (predicate(cursor)) return cursor;
    cursor = cursor.parent;
  }
  return null;
}

/** Sichtbarer Text eines Elements, Leerraum zusammengefasst. */
export function textOf(el: HtmlElement, maxChars = 4000): string {
  const parts: string[] = [];
  let length = 0;
  const pending: HtmlNode[] = [el];
  while (pending.length > 0 && length < maxChars) {
    const node = pending.pop() as HtmlNode;
    if (node.type === 'text') {
      parts.push(node.text);
      length += node.text.length + 1;
      continue;
    }
    if (node !== el && INVISIBLE_TEXT.has(node.tag)) continue;
    // Bilder tragen ihren Alternativtext als Inhalt bei (z. B. Logo-Links).
    if (node.tag === 'img' && node.attrs.alt) {
      parts.push(node.attrs.alt);
      length += node.attrs.alt.length + 1;
    }
    if (node.tag === 'br') parts.push(' ');
    for (let k = node.children.length - 1; k >= 0; k -= 1) pending.push(node.children[k]);
  }
  return collapseSpace(parts.join(' ')).slice(0, maxChars);
}

export function collapseSpace(value: string): string {
  let out = '';
  let pendingSpace = false;
  for (let k = 0; k < value.length; k += 1) {
    const ch = value[k];
    if (isSpace(ch) || ch === ' ' || ch === ' ' || ch === ' ' || ch === ' ') {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      out += ' ';
      pendingSpace = false;
    }
    out += ch;
  }
  return out;
}

export function attrOf(el: HtmlElement, name: string): string | null {
  const value = el.attrs[name];
  return value === undefined ? null : value;
}

export function classesOf(el: HtmlElement): string[] {
  const raw = el.attrs.class;
  if (!raw) return [];
  return raw.split(/\s+/).filter((c) => c !== '').slice(0, 24);
}

/** Klassen, ID und Rolle in einem Kleinbuchstaben-String — für Mustersuche. */
export function identityOf(el: HtmlElement): string {
  return `${el.attrs.id ?? ''} ${el.attrs.class ?? ''} ${el.attrs.role ?? ''}`.toLowerCase();
}

/** Liegt `el` innerhalb eines Elements, das `predicate` erfüllt? */
export function isInside(el: HtmlElement, predicate: (el: HtmlElement) => boolean): boolean {
  return closest(el, predicate) !== null;
}

/**
 * Kompakter, lesbarer Elementpfad für Belege: höchstens die letzten sechs
 * Stufen, je Stufe Tag plus ID oder erste Klasse, bei gleichnamigen
 * Geschwistern die Position.
 */
export function elementPath(el: HtmlElement): string {
  const segments: string[] = [];
  let cursor: HtmlElement | null = el;
  while (cursor && cursor.tag !== '#root' && cursor.tag !== 'html' && segments.length < 6) {
    segments.unshift(segmentOf(cursor));
    cursor = cursor.parent;
  }
  const prefix = cursor && cursor.tag !== '#root' && cursor.tag !== 'html' ? '…>' : '';
  return prefix + segments.join('>');
}

// Position je Tag unter einem Elternelement — einmal je Elternelement
// berechnet. Ohne den Zwischenspeicher scannte jeder Pfad alle Geschwister
// jedes Vorfahren; bei Zehntausenden gleichen Geschwistern wurde das
// quadratisch. Der Baum ändert sich nach `parseHtml` nicht mehr.
const siblingIndexes = new WeakMap<HtmlElement, { position: Map<HtmlElement, number>; count: Map<string, number> }>();

function siblingIndex(parent: HtmlElement): { position: Map<HtmlElement, number>; count: Map<string, number> } {
  let index = siblingIndexes.get(parent);
  if (!index) {
    const position = new Map<HtmlElement, number>();
    const count = new Map<string, number>();
    for (const child of parent.children) {
      if (child.type !== 'element') continue;
      const n = (count.get(child.tag) ?? 0) + 1;
      count.set(child.tag, n);
      position.set(child, n);
    }
    index = { position, count };
    siblingIndexes.set(parent, index);
  }
  return index;
}

function segmentOf(el: HtmlElement): string {
  let segment = el.tag;
  const id = el.attrs.id;
  if (id && /^[A-Za-z][\w-]{0,31}$/.test(id)) {
    segment += `#${id}`;
  } else {
    const cls = classesOf(el).find((c) => /^[A-Za-z_][\w-]{0,31}$/.test(c));
    if (cls) segment += `.${cls}`;
  }
  const parent = el.parent;
  if (parent) {
    const { position, count } = siblingIndex(parent);
    const sameTag = count.get(el.tag) ?? 0;
    if (sameTag > 1) segment += `:nth-of-type(${position.get(el) ?? 0})`;
  }
  return segment;
}

/**
 * Quelltext-Auszug eines Elements, Leerraum zusammengefasst, auf `max`
 * Zeichen gekürzt. Skript- und Style-Inhalte werden ausgelassen — sie sind
 * kein Beleg für eine Aussage über die sichtbare Seite.
 */
export function excerptOf(doc: HtmlDocument, el: HtmlElement, max: number): string {
  const slice = doc.source.slice(el.start, Math.min(el.end, el.start + max * 6));
  const withoutCode = stripRawBlocks(slice);
  const collapsed = collapseSpace(withoutCode);
  return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

/** Entfernt Inhalte von script/style aus einem Auszug (linear). */
function stripRawBlocks(value: string): string {
  let out = '';
  let i = 0;
  const lower = value.toLowerCase();
  while (i < value.length) {
    const nextScript = lower.indexOf('<script', i);
    const nextStyle = lower.indexOf('<style', i);
    const candidates = [nextScript, nextStyle].filter((v) => v !== -1);
    if (candidates.length === 0) {
      out += value.slice(i);
      break;
    }
    const at = Math.min(...candidates);
    const tag = at === nextScript ? 'script' : 'style';
    out += value.slice(i, at);
    const close = lower.indexOf(`</${tag}`, at);
    if (close === -1) break;
    const gt = value.indexOf('>', close);
    out += `<${tag}>…</${tag}>`;
    i = gt === -1 ? value.length : gt + 1;
  }
  return out;
}

/** Text der direkten Kind-Textknoten (ohne Nachfahren). */
export function ownText(el: HtmlElement): string {
  return collapseSpace(el.children.filter((c): c is HtmlText => c.type === 'text').map((c) => c.text).join(' '));
}
