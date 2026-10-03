// Design-System-Layer — aus der vorhandenen Marke ein kontrolliertes Token-Set.
//
// ## Was „kontrolliert" heißt
//
// Die Marke liefert höchstens zwei Dinge: Farben und Schriften. Alles
// andere — Neutraltöne, Abstände, Radien, Buttons, Karten, Formulare,
// Breakpoints, Bewegung — wird hier aus einer festen Skala **abgeleitet**,
// je Richtung mit einem eigenen, benannten Profil. Es gibt keine Stelle, an
// der ein Wert zufällig entsteht: derselbe Import ergibt dasselbe System.
//
// ## Was mit der Markenfarbe passiert
//
// Sie wird übernommen, aber nicht ungeprüft: Auf weißem Grund muss weißer
// Text auf ihr 4.5:1 erreichen (WCAG AA), sonst wird sie schrittweise
// abgedunkelt, bis das gilt — und das Ergebnis wird als `derived`
// gekennzeichnet, nicht als `brand`. Ohne Markenfarbe greift ein
// Fallback je Richtung, ebenfalls gekennzeichnet.
//
// ## Hell oder dunkel
//
// Hell ist Default. Dunkel gibt es nur, wenn die Quelle selbst dunkel
// auftritt (theme-color oder dominante Farbe sehr dunkel) **und** die
// Richtung es trägt (Premium, Governance). Nie als Dekoration.

import { contrastRatio } from '../render/theme.ts';
import type { SiteTheme } from '../types.ts';
import { hexToRgb, lightnessOf, normalizeHex, rgbToHex, saturationOf } from './extract.ts';
import type { DesignSystem, ImportedBrand, RebuildDirectionKey, TokenOrigin, TypographyTokens } from './types.ts';

// ─────────────────────────────────────────────────────────────────────
// Profile je Richtung
// ─────────────────────────────────────────────────────────────────────

interface DirectionProfile {
  fallbackPrimary: string;
  display: TypographyTokens['display'];
  body: TypographyTokens['body'];
  ratio: number;
  radius: { sm: number; md: number; lg: number };
  shadow: 'none' | 'sm' | 'md';
  alternate: boolean;
  motion: DesignSystem['motion'];
  sectionY: { mobile: number; desktop: number };
  buttonHeight: number;
  allowsDark: boolean;
}

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", Times, serif';

const PROFILES: Readonly<Record<RebuildDirectionKey, DirectionProfile>> = Object.freeze({
  'clean-enterprise': {
    fallbackPrimary: '#1F3A8A',
    display: { family: `Inter, ${SANS}`, weight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 },
    body: { family: `Inter, ${SANS}`, weight: 400, lineHeight: 1.6 },
    ratio: 1.25,
    radius: { sm: 6, md: 10, lg: 16 },
    shadow: 'none',
    alternate: true,
    motion: { enabled: true, durationMs: 240, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', allow: ['fade-up'] },
    sectionY: { mobile: 64, desktop: 104 },
    buttonHeight: 48,
    allowsDark: false,
  },
  'conversion-focus': {
    fallbackPrimary: '#0F766E',
    display: { family: `"Plus Jakarta Sans", ${SANS}`, weight: 700, letterSpacing: '-0.025em', lineHeight: 1.08 },
    body: { family: `Inter, ${SANS}`, weight: 400, lineHeight: 1.6 },
    ratio: 1.25,
    radius: { sm: 8, md: 12, lg: 20 },
    shadow: 'sm',
    alternate: true,
    motion: { enabled: true, durationMs: 220, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', allow: ['fade-up'] },
    sectionY: { mobile: 56, desktop: 96 },
    buttonHeight: 52,
    allowsDark: false,
  },
  'local-trust': {
    fallbackPrimary: '#B45309',
    display: { family: `"Source Sans 3", ${SANS}`, weight: 700, letterSpacing: '-0.01em', lineHeight: 1.12 },
    body: { family: `"Source Sans 3", ${SANS}`, weight: 400, lineHeight: 1.65 },
    ratio: 1.2,
    radius: { sm: 6, md: 10, lg: 14 },
    shadow: 'sm',
    alternate: true,
    motion: { enabled: true, durationMs: 200, easing: 'ease-out', allow: ['fade'] },
    sectionY: { mobile: 56, desktop: 88 },
    buttonHeight: 50,
    allowsDark: false,
  },
  'premium-advisory': {
    fallbackPrimary: '#1C1917',
    display: { family: `"Playfair Display", ${SERIF}`, weight: 500, letterSpacing: '-0.01em', lineHeight: 1.12 },
    body: { family: `"Source Serif 4", ${SERIF}`, weight: 400, lineHeight: 1.7 },
    ratio: 1.3,
    radius: { sm: 2, md: 4, lg: 8 },
    shadow: 'none',
    alternate: false,
    motion: { enabled: true, durationMs: 320, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', allow: ['fade'] },
    sectionY: { mobile: 72, desktop: 128 },
    buttonHeight: 48,
    allowsDark: true,
  },
  'governance-first': {
    fallbackPrimary: '#0F3D5E',
    display: { family: `"IBM Plex Sans", ${SANS}`, weight: 600, letterSpacing: '-0.015em', lineHeight: 1.1 },
    body: { family: `"IBM Plex Sans", ${SANS}`, weight: 400, lineHeight: 1.6 },
    ratio: 1.25,
    radius: { sm: 4, md: 6, lg: 10 },
    shadow: 'none',
    alternate: true,
    motion: { enabled: true, durationMs: 200, easing: 'ease-out', allow: ['fade'] },
    sectionY: { mobile: 64, desktop: 104 },
    buttonHeight: 48,
    allowsDark: true,
  },
});

/**
 * Bekannte Web-Schriften mit passendem System-Fallback. Nur diese werden
 * aus der Marke übernommen — ein unbekannter Name wäre in der Vorschau
 * ohnehin nicht geladen (keine Drittanbieter vor Einwilligung) und würde
 * als Fallback-Serifenlos erscheinen, während das System behauptet, die
 * Markenschrift zu nutzen.
 */
const KNOWN_FONTS: Readonly<Record<string, { stack: string; serif: boolean }>> = Object.freeze({
  inter: { stack: `Inter, ${SANS}`, serif: false },
  roboto: { stack: `Roboto, ${SANS}`, serif: false },
  'open sans': { stack: `"Open Sans", ${SANS}`, serif: false },
  lato: { stack: `Lato, ${SANS}`, serif: false },
  montserrat: { stack: `Montserrat, ${SANS}`, serif: false },
  poppins: { stack: `Poppins, ${SANS}`, serif: false },
  'source sans pro': { stack: `"Source Sans Pro", "Source Sans 3", ${SANS}`, serif: false },
  'source sans 3': { stack: `"Source Sans 3", ${SANS}`, serif: false },
  nunito: { stack: `Nunito, ${SANS}`, serif: false },
  'nunito sans': { stack: `"Nunito Sans", ${SANS}`, serif: false },
  raleway: { stack: `Raleway, ${SANS}`, serif: false },
  'work sans': { stack: `"Work Sans", ${SANS}`, serif: false },
  'dm sans': { stack: `"DM Sans", ${SANS}`, serif: false },
  manrope: { stack: `Manrope, ${SANS}`, serif: false },
  'ibm plex sans': { stack: `"IBM Plex Sans", ${SANS}`, serif: false },
  'space grotesk': { stack: `"Space Grotesk", ${SANS}`, serif: false },
  figtree: { stack: `Figtree, ${SANS}`, serif: false },
  'plus jakarta sans': { stack: `"Plus Jakarta Sans", ${SANS}`, serif: false },
  outfit: { stack: `Outfit, ${SANS}`, serif: false },
  rubik: { stack: `Rubik, ${SANS}`, serif: false },
  karla: { stack: `Karla, ${SANS}`, serif: false },
  'playfair display': { stack: `"Playfair Display", ${SERIF}`, serif: true },
  merriweather: { stack: `Merriweather, ${SERIF}`, serif: true },
  lora: { stack: `Lora, ${SERIF}`, serif: true },
  'pt serif': { stack: `"PT Serif", ${SERIF}`, serif: true },
  'source serif pro': { stack: `"Source Serif Pro", "Source Serif 4", ${SERIF}`, serif: true },
  'source serif 4': { stack: `"Source Serif 4", ${SERIF}`, serif: true },
  'libre baskerville': { stack: `"Libre Baskerville", ${SERIF}`, serif: true },
  'crimson text': { stack: `"Crimson Text", ${SERIF}`, serif: true },
  'eb garamond': { stack: `"EB Garamond", ${SERIF}`, serif: true },
});

// ─────────────────────────────────────────────────────────────────────
// Ableitung
// ─────────────────────────────────────────────────────────────────────

export interface DeriveOptions {
  /** Erzwingt einen Modus — nur die Revision („mach es dunkel") nutzt das. */
  mode?: 'light' | 'dark';
}

export function deriveDesignSystem(brand: ImportedBrand, direction: RebuildDirectionKey, options: DeriveOptions = {}): DesignSystem {
  const profile = PROFILES[direction];
  const brandPrimary = pickBrandPrimary(brand);
  const mode = options.mode ?? decideMode(brand, profile);
  const modeRationale = options.mode
    ? 'Modus ausdrücklich gewählt.'
    : mode === 'dark'
      ? 'Die Quelle tritt dunkel auf und die Richtung trägt einen dunklen Modus.'
      : 'Hell ist Default: beste Lesbarkeit, kein dekorativer Dunkelmodus.';

  const neutrals = mode === 'dark' ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  const { primary, origin } = ensureButtonContrast(brandPrimary ?? profile.fallbackPrimary, brandPrimary ? 'brand' : 'fallback', neutrals.background);
  const accent = ensureTextContrast(pickAccent(brand, primary, neutrals.background), neutrals.background);
  const primaryForeground = (contrastRatio('#FFFFFF', primary) ?? 0) >= 4.5 ? '#FFFFFF' : DARK_NEUTRALS.background;

  const { display, body, origin: typoOrigin } = pickTypography(brand, profile);
  const scale = buildScale(profile.ratio);

  return {
    schemaVersion: 1,
    mode,
    modeRationale,
    colors: {
      primary,
      primaryForeground,
      accent,
      background: neutrals.background,
      surface: neutrals.surface,
      surfaceAlt: neutrals.surfaceAlt,
      foreground: neutrals.foreground,
      muted: neutrals.muted,
      border: neutrals.border,
      origin,
    },
    typography: { display, body, scale, origin: typoOrigin },
    spacing: {
      unit: 4,
      scale: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32],
      sectionY: profile.sectionY,
      containerMax: direction === 'premium-advisory' ? 1120 : 1200,
      gutter: 20,
    },
    radius: profile.radius,
    buttons: {
      radius: profile.radius.md,
      height: profile.buttonHeight,
      paddingX: 22,
      weight: direction === 'conversion-focus' ? 700 : 600,
      primary: { background: primary, foreground: primaryForeground, border: primary },
      secondary: { background: 'transparent', foreground: mode === 'dark' ? neutrals.foreground : primary, border: mode === 'dark' ? neutrals.border : primary },
      ghost: { background: 'transparent', foreground: neutrals.foreground, border: 'transparent' },
    },
    cards: {
      background: neutrals.surface,
      border: neutrals.border,
      radius: profile.radius.lg,
      shadow: profile.shadow,
      padding: 24,
    },
    sections: {
      alternate: profile.alternate,
      altBackground: neutrals.surfaceAlt,
      gap: 24,
      measure: 64,
    },
    forms: {
      inputBackground: neutrals.background,
      inputBorder: neutrals.border,
      inputRadius: profile.radius.sm,
      inputHeight: 48,
      labelWeight: 600,
      focusRing: primary,
    },
    breakpoints: { sm: 640, md: 834, lg: 1200 },
    motion: profile.motion,
  };
}

/** Brücke zum bestehenden Blueprint-Theme — damit Renderer, Analyse und Gate unverändert laufen. */
export function designSystemToTheme(ds: DesignSystem): SiteTheme {
  return {
    mode: ds.mode,
    accent: ds.colors.primary,
    surface: ds.colors.background,
    foreground: ds.colors.foreground,
    fontDisplay: ds.typography.display.family,
    fontBody: ds.typography.body.family,
    radiusPx: ds.radius.md,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Farben
// ─────────────────────────────────────────────────────────────────────

const LIGHT_NEUTRALS = Object.freeze({
  background: '#FFFFFF',
  surface: '#F7F7F5',
  surfaceAlt: '#F1F2F0',
  foreground: '#15181C',
  muted: '#5B6470',
  border: '#E2E5E9',
});

const DARK_NEUTRALS = Object.freeze({
  background: '#0B0D10',
  surface: '#13161B',
  surfaceAlt: '#181C22',
  foreground: '#ECEEF1',
  muted: '#9AA3AE',
  border: '#262B33',
});

function pickBrandPrimary(brand: ImportedBrand): string | null {
  const candidates = [brand.themeColor, ...brand.colors].map((c) => (c ? normalizeHex(c) : null)).filter((c): c is string => c !== null);
  // Bevorzugt die häufigste gesättigte Farbe; theme-color zählt, wenn sie gesättigt ist.
  return candidates.find((c) => saturationOf(c) >= 0.12 && lightnessOf(c) > 0.08 && lightnessOf(c) < 0.92) ?? null;
}

function pickAccent(brand: ImportedBrand, primary: string, background: string): string {
  const second = brand.colors.map(normalizeHex).find((c): c is string => c !== null && c !== primary && hueDistance(c, primary) > 30 && saturationOf(c) >= 0.15);
  if (second) return second;
  return shiftLightness(primary, lightnessOf(background) < 0.5 ? 0.12 : -0.12);
}

function decideMode(brand: ImportedBrand, profile: DirectionProfile): 'light' | 'dark' {
  if (!profile.allowsDark) return 'light';
  const signal = brand.themeColor ?? brand.colors[0] ?? null;
  return signal !== null && lightnessOf(signal) < 0.18 ? 'dark' : 'light';
}

/**
 * Sorgt dafür, dass die Farbe als Button taugt: Sie muss sich 3:1 vom
 * Hintergrund absetzen (WCAG 1.4.11), und ihr Text (weiß oder die
 * Vordergrundfarbe) muss 4.5:1 erreichen. Auf hellem Grund wird dafür
 * abgedunkelt, auf dunklem Grund aufgehellt — in Schritten von 4 %,
 * höchstens zwölfmal.
 */
function ensureButtonContrast(hex: string, origin: TokenOrigin, background: string): { primary: string; origin: TokenOrigin } {
  let current = normalizeHex(hex) ?? '#1F3A8A';
  const darkBackground = lightnessOf(background) < 0.5;
  const step = darkBackground ? 0.04 : -0.04;
  let changed = false;
  for (let i = 0; i < 12; i += 1) {
    const surfaceOk = (contrastRatio(current, background) ?? 0) >= 3;
    // Auf hellem Grund muss weißer Text passen; auf dunklem Grund reicht es,
    // wenn eine der beiden Textfarben passt (der Aufrufer wählt sie).
    const textOk = darkBackground
      ? (contrastRatio('#FFFFFF', current) ?? 0) >= 4.5 || (contrastRatio(DARK_NEUTRALS.background, current) ?? 0) >= 4.5
      : (contrastRatio('#FFFFFF', current) ?? 0) >= 4.5;
    if (textOk && surfaceOk) break;
    current = shiftLightness(current, step);
    changed = true;
  }
  return { primary: current, origin: changed && origin === 'brand' ? 'derived' : origin };
}

/** Text in dieser Farbe muss auf dem Hintergrund 4.5:1 erreichen — sonst wird sie angepasst. */
function ensureTextContrast(hex: string, background: string): string {
  let current = normalizeHex(hex) ?? '#1F3A8A';
  const step = lightnessOf(background) < 0.5 ? 0.05 : -0.05;
  for (let i = 0; i < 14 && (contrastRatio(current, background) ?? 0) < 4.5; i += 1) current = shiftLightness(current, step);
  return current;
}

export function shiftLightness(hex: string, delta: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, l + delta)));
  return rgbToHex(r, g, b) ?? hex;
}

export function desaturate(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const [r, g, b] = hslToRgb(h, Math.max(0, s - amount), l);
  return rgbToHex(r, g, b) ?? hex;
}

function hueDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 0;
  const ha = rgbToHsl(ra[0], ra[1], ra[2])[0] * 360;
  const hb = rgbToHsl(rb[0], rb[1], rb[2])[0] * 360;
  const d = Math.abs(ha - hb);
  return Math.min(d, 360 - d);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [Math.round(channel(h + 1 / 3) * 255), Math.round(channel(h) * 255), Math.round(channel(h - 1 / 3) * 255)];
}

// ─────────────────────────────────────────────────────────────────────
// Typografie
// ─────────────────────────────────────────────────────────────────────

function pickTypography(brand: ImportedBrand, profile: DirectionProfile): { display: TypographyTokens['display']; body: TypographyTokens['body']; origin: TokenOrigin } {
  const known = brand.fonts.map((f) => KNOWN_FONTS[f.toLowerCase()]).filter((f): f is { stack: string; serif: boolean } => f !== undefined);
  if (known.length === 0) return { display: profile.display, body: profile.body, origin: 'fallback' };

  const primary = known[0];
  const secondary = known.find((f) => f.serif !== primary.serif) ?? null;
  // Serife Markenschrift trägt die Überschriften; der Fließtext bleibt
  // serifenlos, wenn die Marke keine zweite Schrift nennt — lange Absätze
  // in Serife auf dem Bildschirm sind eine Entscheidung, keine Ableitung.
  const display = { ...profile.display, family: primary.stack };
  const body = secondary
    ? { ...profile.body, family: secondary.serif ? profile.body.family : secondary.stack }
    : { ...profile.body, family: primary.serif ? profile.body.family : primary.stack };
  return { display, body, origin: 'brand' };
}

function buildScale(ratio: number): TypographyTokens['scale'] {
  const step = (n: number) => Math.round(Math.pow(ratio, n) * 1000) / 1000;
  return {
    xs: step(-2),
    sm: step(-1),
    base: 1,
    lg: step(1),
    xl: step(2),
    '2xl': step(3),
    '3xl': step(4),
    '4xl': step(5),
  };
}

/** Wandelt ein Design-System in CSS-Variablen — die eine Quelle für Vorschau und Export. */
export function designSystemCssVariables(ds: DesignSystem): string {
  const c = ds.colors;
  const t = ds.typography;
  const lines = [
    `--rs-primary:${c.primary}`,
    `--rs-primary-fg:${c.primaryForeground}`,
    `--rs-accent:${c.accent}`,
    `--rs-bg:${c.background}`,
    `--rs-surface:${c.surface}`,
    `--rs-surface-alt:${c.surfaceAlt}`,
    `--rs-fg:${c.foreground}`,
    `--rs-muted:${c.muted}`,
    `--rs-border:${c.border}`,
    `--rs-font-display:${t.display.family}`,
    `--rs-font-body:${t.body.family}`,
    `--rs-display-weight:${t.display.weight}`,
    `--rs-display-tracking:${t.display.letterSpacing}`,
    `--rs-display-lh:${t.display.lineHeight}`,
    `--rs-body-weight:${t.body.weight}`,
    `--rs-body-lh:${t.body.lineHeight}`,
    `--rs-text-xs:${t.scale.xs}rem`,
    `--rs-text-sm:${t.scale.sm}rem`,
    `--rs-text-lg:${t.scale.lg}rem`,
    `--rs-text-xl:${t.scale.xl}rem`,
    `--rs-text-2xl:${t.scale['2xl']}rem`,
    `--rs-text-3xl:${t.scale['3xl']}rem`,
    `--rs-text-4xl:${t.scale['4xl']}rem`,
    `--rs-unit:${ds.spacing.unit}px`,
    `--rs-section-y:${ds.spacing.sectionY.mobile}px`,
    `--rs-section-y-lg:${ds.spacing.sectionY.desktop}px`,
    `--rs-container:${ds.spacing.containerMax}px`,
    `--rs-gutter:${ds.spacing.gutter}px`,
    `--rs-radius-sm:${ds.radius.sm}px`,
    `--rs-radius-md:${ds.radius.md}px`,
    `--rs-radius-lg:${ds.radius.lg}px`,
    `--rs-btn-h:${ds.buttons.height}px`,
    `--rs-btn-px:${ds.buttons.paddingX}px`,
    `--rs-btn-weight:${ds.buttons.weight}`,
    `--rs-btn-radius:${ds.buttons.radius}px`,
    `--rs-card-bg:${ds.cards.background}`,
    `--rs-card-border:${ds.cards.border}`,
    `--rs-card-radius:${ds.cards.radius}px`,
    `--rs-card-pad:${ds.cards.padding}px`,
    `--rs-card-shadow:${ds.cards.shadow === 'none' ? 'none' : ds.cards.shadow === 'sm' ? '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -16px rgba(0,0,0,0.18)' : '0 2px 6px rgba(0,0,0,0.08), 0 20px 40px -20px rgba(0,0,0,0.25)'}`,
    `--rs-input-bg:${ds.forms.inputBackground}`,
    `--rs-input-border:${ds.forms.inputBorder}`,
    `--rs-input-radius:${ds.forms.inputRadius}px`,
    `--rs-input-h:${ds.forms.inputHeight}px`,
    `--rs-focus:${ds.forms.focusRing}`,
    `--rs-measure:${ds.sections.measure}ch`,
    `--rs-motion-ms:${ds.motion.enabled ? ds.motion.durationMs : 0}ms`,
    `--rs-motion-ease:${ds.motion.easing}`,
  ];
  return `:root{${lines.join(';')}}`;
}
