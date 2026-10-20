// CSS-Signale einer bestehenden Website: Markenfarben, Schriften, Radien und
// die statischen Hinweise auf responsives Verhalten.
//
// Gelesen wird mit einem Zustandsautomaten in einer Vorwärtsbewegung —
// Selektor bis `{`, Deklaration bis `;` oder `}`, Kommentare und
// Zeichenketten übersprungen. Kein Regex über das ganze Stylesheet: Das CSS
// kommt von einer fremden Website (siehe Begründung in `html.ts`).
//
// Was hier NICHT passiert: Kaskade, Spezifität, berechnete Werte. Die Frage
// ist nicht „welche Farbe hat dieser Knopf", sondern „welche Farben setzt
// diese Marke bewusst ein". Dafür genügt die Häufigkeit, gewichtet nach dem
// Ort der Verwendung (Variablen, Schaltflächen, Links).

import { normalizeColor } from './color.ts';

export interface CssAccumulatorResult {
  colors: { hex: string; count: number; weight: number }[];
  fonts: { family: string; count: number; fontFace: boolean; headingUses: number }[];
  mediaQueryCount: number;
  maxFixedWidthPx: number | null;
  minFontPx: number | null;
  usesFlexOrGrid: boolean;
  radiiPx: number[];
  pageBackground: string | null;
  observedChars: number;
}

const MAX_RADII = 400;

/** Namen von Variablen, die fast immer Markenfarben tragen. */
const BRAND_VARIABLE = /(primary|brand|accent|main|key|highlight|cta|theme|secondary)/;
/** Selektoren, deren Farben Bedienelemente einfärben. */
const ACCENT_SELECTOR = /(btn|button|cta|primary|accent|highlight|(^|[\s,>+~])a(?![\w-])|a:hover|a:link|\.link)/;
const PAGE_SELECTOR = /^(html|body|:root|html\s*,\s*body|body\s*,\s*html)$/;
/** Selektoren für Überschriften — dort gesetzte Schriften sind die Display-Schrift. */
const HEADING_SELECTOR = /(^|[\s,>+~])h[1-3](?![\w-])|heading|headline|title/;

/** Generische Familien und Symbolschriften sind keine Markenschrift. */
const IGNORED_FAMILIES: ReadonlySet<string> = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif',
  'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'inherit', 'initial', 'unset',
  'revert', 'emoji', 'math', 'fangsong', 'font awesome 5 free', 'font awesome 5 brands', 'font awesome 6 free',
  'font awesome 6 brands', 'fontawesome', 'font awesome', 'dashicons', 'icomoon', 'material icons',
  'material symbols outlined', 'eicons', 'bootstrap-icons', 'glyphicons halflings', 'etmodules', 'revicons',
  'star', 'woocommerce', 'genericons', 'themify', 'feather', 'lucide',
]);

interface Block {
  kind: 'rule' | 'media' | 'font-face' | 'at';
  selector: string;
}

export class CssAccumulator {
  private readonly colors = new Map<string, { count: number; weight: number }>();
  private readonly fonts = new Map<string, { family: string; count: number; fontFace: boolean; headingUses: number }>();
  private mediaQueryCount = 0;
  private maxFixedWidthPx: number | null = null;
  private minFontPx: number | null = null;
  private usesFlexOrGrid = false;
  private readonly radiiPx: number[] = [];
  private pageBackground: string | null = null;
  private observedChars = 0;

  /** Liest ein vollständiges Stylesheet (`<style>` oder abgerufene Datei). */
  addStylesheet(css: string): void {
    this.observedChars += css.length;
    const stack: Block[] = [];
    // Tiefe der offenen @media-Blöcke — mitgezählt statt je Deklaration den
    // ganzen Stapel zu durchsuchen (bei tief verschachteltem CSS quadratisch).
    let mediaDepth = 0;
    let buffer = '';
    let parenDepth = 0;
    let i = 0;
    const n = css.length;

    while (i < n) {
      const ch = css[i];
      if (ch === '/' && css[i + 1] === '*') {
        const close = css.indexOf('*/', i + 2);
        i = close === -1 ? n : close + 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const close = css.indexOf(ch, i + 1);
        const stop = close === -1 ? n : close + 1;
        buffer += css.slice(i, stop);
        i = stop;
        continue;
      }
      if (ch === '(') parenDepth += 1;
      if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);

      if (ch === '{' && parenDepth === 0) {
        const prelude = buffer.trim();
        buffer = '';
        const block = this.openBlock(prelude);
        if (block.kind === 'media') mediaDepth += 1;
        stack.push(block);
        i += 1;
        continue;
      }
      if (ch === ';' && parenDepth === 0) {
        this.declaration(buffer, stack[stack.length - 1], mediaDepth > 0);
        buffer = '';
        i += 1;
        continue;
      }
      if (ch === '}' && parenDepth === 0) {
        this.declaration(buffer, stack[stack.length - 1], mediaDepth > 0);
        buffer = '';
        const closed = stack.pop();
        if (closed?.kind === 'media') mediaDepth -= 1;
        i += 1;
        continue;
      }
      buffer += ch;
      i += 1;
    }
  }

  /**
   * Liest die Deklarationen eines `style`-Attributs. `accentContext` sagt,
   * ob das Element ein Bedienelement ist (Link, Schaltfläche).
   */
  addInlineStyle(style: string, accentContext: boolean): void {
    this.observedChars += style.length;
    const context: Block = { kind: 'rule', selector: accentContext ? 'button' : '[style]' };
    let buffer = '';
    let parenDepth = 0;
    for (let i = 0; i < style.length; i += 1) {
      const ch = style[i];
      if (ch === '(') parenDepth += 1;
      if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
      if (ch === ';' && parenDepth === 0) {
        this.declaration(buffer, context, false);
        buffer = '';
      } else {
        buffer += ch;
      }
    }
    this.declaration(buffer, context, false);
  }

  /** Farbe aus einer Quelle außerhalb von CSS (theme-color, SVG-Füllung im Logo). */
  addColor(raw: string, weight: number): void {
    const hex = normalizeColor(raw);
    if (hex) this.bumpColor(hex, weight);
  }

  /** Schriftfamilie aus einer Quelle außerhalb von CSS (Google-Fonts-Link). */
  addFontFamily(family: string, fontFace = false, heading = false): void {
    const clean = cleanFamily(family);
    if (!clean) return;
    const key = clean.toLowerCase();
    const entry = this.fonts.get(key) ?? { family: clean, count: 0, fontFace: false, headingUses: 0 };
    entry.count += 1;
    entry.fontFace = entry.fontFace || fontFace;
    if (heading) entry.headingUses += 1;
    this.fonts.set(key, entry);
  }

  result(): CssAccumulatorResult {
    return {
      colors: [...this.colors.entries()]
        .map(([hex, v]) => ({ hex, count: v.count, weight: v.weight }))
        .sort((a, b) => b.weight - a.weight || b.count - a.count || (a.hex < b.hex ? -1 : 1)),
      fonts: [...this.fonts.values()].sort((a, b) => b.count - a.count || (a.family < b.family ? -1 : 1)),
      mediaQueryCount: this.mediaQueryCount,
      maxFixedWidthPx: this.maxFixedWidthPx,
      minFontPx: this.minFontPx,
      usesFlexOrGrid: this.usesFlexOrGrid,
      radiiPx: [...this.radiiPx],
      pageBackground: this.pageBackground,
      observedChars: this.observedChars,
    };
  }

  // ── intern ────────────────────────────────────────────────────────

  private openBlock(prelude: string): Block {
    // Selektoren werden je Deklaration gegen Muster geprüft; ein
    // übergroßer Selektor (Hunderte KB) machte daraus eine quadratische
    // Prüfung. Für Überschrift/Schaltfläche/Seite genügt der Anfang.
    const lower = prelude.slice(0, 400).toLowerCase();
    if (lower.startsWith('@media')) {
      this.mediaQueryCount += 1;
      return { kind: 'media', selector: lower };
    }
    if (lower.startsWith('@font-face')) return { kind: 'font-face', selector: lower };
    if (lower.startsWith('@')) return { kind: 'at', selector: lower };
    return { kind: 'rule', selector: lower };
  }

  private declaration(raw: string, block: Block | undefined, insideMedia: boolean): void {
    const colon = raw.indexOf(':');
    if (colon <= 0) return;
    const property = raw.slice(0, colon).trim().toLowerCase();
    if (property === '' || property.includes('{') || property.includes('}')) return;
    const value = raw.slice(colon + 1).replace(/!important/gi, '').trim();
    if (value === '') return;

    const selector = block?.selector ?? '';
    const inFontFace = block?.kind === 'font-face';

    // Variablen
    if (property.startsWith('--')) {
      if (BRAND_VARIABLE.test(property)) {
        const hex = singleColor(value);
        if (hex) this.bumpColor(hex, 5);
      }
      if (property.includes('font') && !property.includes('size') && !property.includes('weight')) {
        const first = firstFamily(value);
        if (first) this.addFontFamily(first);
      }
      return;
    }

    if (property === 'font-family') {
      if (inFontFace) {
        this.addFontFamily(value, true);
        return;
      }
      const first = firstFamily(value);
      if (first) this.addFontFamily(first, false, HEADING_SELECTOR.test(selector));
      return;
    }
    if (property === 'font') {
      const family = familyFromShorthand(value);
      if (family) this.addFontFamily(family, false, HEADING_SELECTOR.test(selector));
      const size = pxOf(value.split(/\s+/).find((t) => /\d(px|rem|em)/.test(t)) ?? '');
      if (size !== null) this.trackFontSize(size);
      return;
    }
    if (property === 'font-size') {
      const size = pxOf(value);
      if (size !== null) this.trackFontSize(size);
      return;
    }
    if ((property === 'width' || property === 'min-width') && !insideMedia) {
      const px = value.endsWith('px') ? parseFloat(value) : NaN;
      if (Number.isFinite(px) && px >= 600 && px <= 4000) {
        this.maxFixedWidthPx = Math.max(this.maxFixedWidthPx ?? 0, Math.round(px));
      }
      return;
    }
    if (property === 'display') {
      if (/\b(flex|grid|inline-flex|inline-grid)\b/.test(value)) this.usesFlexOrGrid = true;
      return;
    }
    if (property === 'border-radius') {
      const first = value.split(/\s+/)[0] ?? '';
      const px = pxOf(first);
      if (px !== null && this.radiiPx.length < MAX_RADII) this.radiiPx.push(Math.min(Math.round(px), 64));
      return;
    }

    if (isColorProperty(property)) {
      const accent = ACCENT_SELECTOR.test(selector) && (property === 'background' || property === 'background-color' || property === 'color' || property === 'border-color');
      for (const hex of colorsIn(value)) {
        this.bumpColor(hex, accent ? 3 : 1);
        if ((property === 'background' || property === 'background-color') && PAGE_SELECTOR.test(selector.trim()) && this.pageBackground === null) {
          this.pageBackground = hex;
        }
      }
    }
  }

  private trackFontSize(px: number): void {
    if (px <= 0 || px > 100) return;
    this.minFontPx = this.minFontPx === null ? px : Math.min(this.minFontPx, px);
  }

  private bumpColor(hex: string, weight: number): void {
    const entry = this.colors.get(hex) ?? { count: 0, weight: 0 };
    entry.count += 1;
    // Häufige Wiederholung derselben Deklaration soll eine einzelne
    // Variable nicht beliebig überstimmen: Beitrag je Vorkommen gedeckelt.
    entry.weight += Math.min(weight, 6);
    this.colors.set(hex, entry);
  }
}

function isColorProperty(property: string): boolean {
  return (
    property === 'color'
    || property === 'background'
    || property === 'background-color'
    || property === 'border'
    || property === 'border-color'
    || property === 'border-top'
    || property === 'border-bottom'
    || property === 'border-left'
    || property === 'border-right'
    || property === 'border-top-color'
    || property === 'border-bottom-color'
    || property === 'outline-color'
    || property === 'fill'
    || property === 'stroke'
    || property === 'text-decoration-color'
  );
}

/** Alle Farbwerte in einem Deklarationswert (Hex, rgb[a], hsl[a]). */
export function colorsIn(value: string): string[] {
  const out: string[] = [];
  const lower = value.toLowerCase();
  let i = 0;
  while (i < lower.length) {
    const ch = lower[i];
    if (ch === '#') {
      let j = i + 1;
      while (j < lower.length && /[0-9a-f]/.test(lower[j])) j += 1;
      const len = j - i - 1;
      if (len === 3 || len === 4 || len === 6 || len === 8) {
        const hex = normalizeColor(lower.slice(i, j));
        if (hex) out.push(hex);
      }
      i = j;
      continue;
    }
    if ((lower.startsWith('rgb', i) || lower.startsWith('hsl', i)) && (i === 0 || !/[a-z-]/.test(lower[i - 1]))) {
      const close = lower.indexOf(')', i);
      if (close === -1) break;
      const hex = normalizeColor(lower.slice(i, close + 1));
      if (hex) out.push(hex);
      i = close + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

function singleColor(value: string): string | null {
  const found = colorsIn(value);
  return found.length === 1 ? found[0] : null;
}

/** Erste Familie einer Liste — die, die der Gestalter gemeint hat. */
export function firstFamily(value: string): string | null {
  for (const part of splitFamilies(value)) {
    const clean = cleanFamily(part);
    if (clean) return clean;
  }
  return null;
}

function splitFamilies(value: string): string[] {
  const parts: string[] = [];
  let buffer = '';
  let quote: string | null = null;
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = null;
      buffer += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buffer += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  parts.push(buffer);
  return parts;
}

/** Bereinigt einen Familiennamen; generische und Symbolschriften → `null`. */
export function cleanFamily(raw: string): string | null {
  const unquoted = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (unquoted === '' || unquoted.length > 60) return null;
  if (unquoted.startsWith('var(') || unquoted.includes('(')) return null;
  if (!/^[A-Za-z0-9 _-]+$/.test(unquoted)) return null;
  if (IGNORED_FAMILIES.has(unquoted.toLowerCase())) return null;
  return unquoted;
}

function familyFromShorthand(value: string): string | null {
  // `font: italic 700 1rem/1.4 "Inter", sans-serif` — die Familie folgt auf
  // die Größenangabe.
  const tokens = value.split(/\s+/);
  const sizeIndex = tokens.findIndex((t) => /\d(px|rem|em|pt|%)/.test(t));
  if (sizeIndex === -1) return null;
  return firstFamily(tokens.slice(sizeIndex + 1).join(' '));
}

/** Liest px, rem und em (bei 16px Basis) — alles andere → `null`. */
export function pxOf(value: string): number | null {
  const v = value.trim().toLowerCase();
  const num = parseFloat(v);
  if (!Number.isFinite(num)) return null;
  if (v.endsWith('px')) return num;
  if (v.endsWith('rem') || v.endsWith('em')) return num * 16;
  if (/^\d+(\.\d+)?$/.test(v) && num === 0) return 0;
  return null;
}
