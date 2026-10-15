// Farbwerkzeuge für Extraktion und Design-System.
//
// Getrennt von `render/theme.ts`, weil dort ausschließlich **geprüft** wird
// (Werte aus dem Blueprint sind feindliche Eingabe). Hier wird **gerechnet**:
// Farben aus fremdem CSS normalisieren, gruppieren und so weit aufhellen oder
// abdunkeln, dass sie WCAG AA erreichen — ohne den Farbton der Marke zu
// verlassen.

import { contrastRatio } from '../render/theme.ts';

export interface Rgb { r: number; g: number; b: number }
export interface Hsl { h: number; s: number; l: number }

const HEX_DIGITS = /^[0-9a-fA-F]+$/;

/**
 * Liest eine CSS-Farbangabe (Hex, rgb[a], hsl[a]) und liefert `#rrggbb`.
 * Transparente Werte (Alpha < 0.35) zählen nicht als Markenfarbe → `null`.
 */
export function normalizeColor(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    if (!HEX_DIGITS.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      if (hex.length === 4 && parseInt(hex[3] + hex[3], 16) / 255 < 0.35) return null;
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    if (hex.length === 6) return `#${hex}`;
    if (hex.length === 8) {
      if (parseInt(hex.slice(6, 8), 16) / 255 < 0.35) return null;
      return `#${hex.slice(0, 6)}`;
    }
    return null;
  }
  const open = value.indexOf('(');
  const close = value.lastIndexOf(')');
  if (open === -1 || close <= open) return null;
  const fn = value.slice(0, open).trim();
  const parts = value
    .slice(open + 1, close)
    .replace(/\//g, ' ')
    .replace(/,/g, ' ')
    .split(' ')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  if (parts.length < 3) return null;
  const alpha = parts.length >= 4 ? parseAlpha(parts[3]) : 1;
  if (alpha === null || alpha < 0.35) return null;

  if (fn === 'rgb' || fn === 'rgba') {
    const channels = parts.slice(0, 3).map(parseChannel);
    if (channels.some((c) => c === null)) return null;
    return rgbToHex({ r: channels[0] as number, g: channels[1] as number, b: channels[2] as number });
  }
  if (fn === 'hsl' || fn === 'hsla') {
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);
    if (![h, s, l].every(Number.isFinite)) return null;
    return rgbToHex(hslToRgb({ h: ((h % 360) + 360) % 360, s: clamp(s / 100, 0, 1), l: clamp(l / 100, 0, 1) }));
  }
  return null;
}

function parseChannel(part: string): number | null {
  if (part.endsWith('%')) {
    const pct = parseFloat(part);
    return Number.isFinite(pct) ? Math.round(clamp(pct, 0, 100) * 2.55) : null;
  }
  const v = parseFloat(part);
  return Number.isFinite(v) ? Math.round(clamp(v, 0, 255)) : null;
}

function parseAlpha(part: string): number | null {
  if (part.endsWith('%')) {
    const pct = parseFloat(part);
    return Number.isFinite(pct) ? clamp(pct / 100, 0, 1) : null;
  }
  const v = parseFloat(part);
  return Number.isFinite(v) ? clamp(v, 0, 1) : null;
}

export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '');
  if (value.length !== 6 || !HEX_DIGITS.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const channel = (t: number) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  return { r: channel(hk + 1 / 3) * 255, g: channel(hk) * 255, b: channel(hk - 1 / 3) * 255 };
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

export function hslToHex(hsl: Hsl): string {
  return rgbToHex(hslToRgb(hsl));
}

/**
 * Taugt die Farbe als Markenakzent? Grautöne, fast Weiß und fast Schwarz
 * sind Gestaltungsflächen, keine Marke — sie würden sonst jede
 * Häufigkeitszählung gewinnen.
 */
export function isBrandCandidate(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  return hsl.s >= 0.25 && hsl.l >= 0.12 && hsl.l <= 0.85;
}

/** Abstand zweier Farben im RGB-Raum (0–441). Für das Zusammenfassen naher Töne. */
export function colorDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return Number.POSITIVE_INFINITY;
  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
}

/**
 * Verschiebt die Helligkeit einer Farbe in Schritten von 2 %, bis sie gegen
 * `background` das Verhältnis `min` erreicht. Farbton und Sättigung bleiben
 * — die Marke bleibt erkennbar. Liefert die Ausgangsfarbe, wenn sie bereits
 * genügt; `null`, wenn kein Wert der Farbfamilie genügt.
 */
export function ensureContrast(hex: string, background: string, min: number): string | null {
  const initial = contrastRatio(hex, background);
  if (initial !== null && initial >= min) return hex.toLowerCase();
  const hsl = hexToHsl(hex);
  const bg = hexToHsl(background);
  if (!hsl || !bg) return null;
  // Auf hellem Grund abdunkeln, auf dunklem aufhellen.
  const direction = bg.l > 0.5 ? -1 : 1;
  for (let step = 1; step <= 50; step += 1) {
    const l = clamp(hsl.l + direction * step * 0.02, 0, 1);
    const candidate = hslToHex({ h: hsl.h, s: hsl.s, l });
    const ratio = contrastRatio(candidate, background);
    if (ratio !== null && ratio >= min) return candidate;
    if (l === 0 || l === 1) break;
  }
  return null;
}

/** Relative Leuchtdichte einfach gehalten für Hell/Dunkel-Entscheidungen. */
export function isDark(hex: string): boolean {
  const hsl = hexToHsl(hex);
  return hsl !== null && hsl.l < 0.28;
}

export function mix(a: string, b: string, weightOfA: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  const w = clamp(weightOfA, 0, 1);
  return rgbToHex({ r: x.r * w + y.r * (1 - w), g: x.g * w + y.g * (1 - w), b: x.b * w + y.b * (1 - w) });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
