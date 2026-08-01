// Theme Engine: SiteTheme → CSS.
//
// Die Theme-Werte stammen aus dem Blueprint und damit mittelbar aus einem
// Prompt oder einer Modellausgabe. Ein Wert wie
//
//     accent: "red } body { display: none } .x {"
//
// würde in einem naiv zusammengesetzten Stylesheet ausbrechen und die
// gesamte Seite umschreiben. CSS lässt sich nicht wie HTML escapen — es
// gibt keine Entity-Schreibweise, die einen Wert sicher neutralisiert.
//
// Deshalb gilt hier dasselbe Prinzip wie bei `safeUrl`: **prüfen und
// verwerfen, nicht escapen.** Jeder Wert muss ein enges Muster erfüllen;
// erfüllt er es nicht, greift der dokumentierte Default. Das Stylesheet
// enthält damit ausschließlich Werte, die dieses Modul selbst gebilligt hat.

import type { SiteTheme } from '../types.ts';

/**
 * Fällt ein Wert durch die Prüfung, gilt dieser Default.
 *
 * Der Akzent ist bewusst NICHT das Marken-Blau #0052FF: auf Obsidian
 * (#0A0A0B) erreicht es nur 3.44:1 und verfehlt damit WCAG AA für
 * Fließtext (4.5:1) — Links wären für viele Nutzer schwer lesbar.
 * #4C82FF ist die aufgehellte Variante derselben Farbfamilie und
 * erreicht 5.60:1. Das Marken-Blau bleibt im Dashboard unverändert;
 * betroffen ist allein das Default-Theme generierter Kundenseiten.
 *
 * Ein Default, der die eigene Prüfung nicht besteht, wäre der Kern des
 * Problems, das diese Plattform lösen soll.
 */
export const THEME_FALLBACK: Readonly<SiteTheme> = Object.freeze({
  mode: 'dark',
  accent: '#4C82FF',
  surface: '#0A0A0B',
  foreground: '#E2E2E2',
  fontDisplay: 'system-ui, sans-serif',
  fontBody: 'system-ui, sans-serif',
  radiusPx: 0,
});

// #rgb, #rrggbb, #rrggbbaa
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
// rgb()/rgba()/hsl()/hsla() mit ausschließlich Zahlen, %, Komma, Punkt, Slash.
const FUNCTIONAL_COLOR = /^(?:rgba?|hsla?)\([0-9.,%\s/]+\)$/;
// Benannte Farben: reine Buchstaben, damit kein `;` oder `}` durchkommt.
const NAMED_COLOR = /^[a-zA-Z]{3,20}$/;

/**
 * Gibt die Farbe zurück, wenn sie unbedenklich ist — sonst `null`.
 * Bewusst ohne `var(…)`, `url(…)` und `calc(…)`: alle drei erlauben
 * Konstruktionen, die aus dem Deklarationswert ausbrechen oder externe
 * Ressourcen laden können.
 */
export function safeColor(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;
  // Ein Semikolon oder eine geschweifte Klammer beendet die Deklaration
  // bzw. den Block — solche Werte werden nie akzeptiert.
  if (/[;{}<>\\]/.test(raw)) return null;

  if (HEX_COLOR.test(raw) || FUNCTIONAL_COLOR.test(raw) || NAMED_COLOR.test(raw)) return raw;
  return null;
}

/**
 * Prüft einen Font-Stack. Erlaubt sind Familiennamen, Anführungszeichen und
 * Kommata — nichts, was eine Deklaration beenden könnte.
 */
export function safeFontStack(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (raw === '') return null;
  if (raw.length > 200) return null;
  if (!/^[a-zA-Z0-9\s,'"-]+$/.test(raw)) return null;
  // Ungerade Anzahl Anführungszeichen ⇒ unbalanciert ⇒ verwerfen.
  if ((raw.match(/"/g)?.length ?? 0) % 2 !== 0) return null;
  if ((raw.match(/'/g)?.length ?? 0) % 2 !== 0) return null;
  return raw;
}

/** Radius in Pixeln, auf 0–64 begrenzt. Nicht-Zahlen fallen auf 0. */
export function safeRadius(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 64);
}

/** Nimmt ein Theme entgegen und gibt eine garantiert unbedenkliche Fassung zurück. */
export function sanitizeTheme(theme: Partial<SiteTheme> | undefined): SiteTheme {
  return {
    mode: theme?.mode === 'light' ? 'light' : 'dark',
    accent: safeColor(theme?.accent) ?? THEME_FALLBACK.accent,
    surface: safeColor(theme?.surface) ?? THEME_FALLBACK.surface,
    foreground: safeColor(theme?.foreground) ?? THEME_FALLBACK.foreground,
    fontDisplay: safeFontStack(theme?.fontDisplay) ?? THEME_FALLBACK.fontDisplay,
    fontBody: safeFontStack(theme?.fontBody) ?? THEME_FALLBACK.fontBody,
    radiusPx: safeRadius(theme?.radiusPx),
  };
}

/**
 * Erzeugt das Stylesheet der Site. Deterministisch: gleiches Theme ⇒
 * gleiches CSS.
 *
 * Der Umfang ist bewusst klein. Es geht nicht um ein Design-System, sondern
 * um lesbare, bedienbare Grundgestaltung: Kontrast, Zeilenlänge,
 * Fokus-Sichtbarkeit, Sprungmarke. Alles Weitere gehört in eine
 * Komponentenbibliothek, nicht in den Kern.
 */
export function renderThemeCss(theme: Partial<SiteTheme> | undefined): string {
  const t = sanitizeTheme(theme);

  return [
    ':root{',
    `--accent:${t.accent};`,
    `--surface:${t.surface};`,
    `--foreground:${t.foreground};`,
    `--font-display:${t.fontDisplay};`,
    `--font-body:${t.fontBody};`,
    `--radius:${t.radiusPx}px;`,
    '}',
    '*,*::before,*::after{box-sizing:border-box;}',
    'body{margin:0;background:var(--surface);color:var(--foreground);',
    'font-family:var(--font-body);line-height:1.6;}',
    // Zeilenlänge begrenzen — lange Zeilen sind schwer lesbar (WCAG 1.4.8).
    'main,header,footer{max-width:72ch;margin:0 auto;padding:1.5rem;}',
    'h1,h2,h3{font-family:var(--font-display);line-height:1.25;}',
    'a{color:var(--accent);}',
    // Fokus muss sichtbar sein (WCAG 2.2 — 2.4.7). Nie auf `none` setzen.
    'a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{',
    'outline:3px solid var(--accent);outline-offset:2px;}',
    // Die Sprungmarke bleibt für Screenreader erreichbar und wird bei
    // Tastaturfokus sichtbar — sie darf nicht per display:none entfallen.
    '.skip-link{position:absolute;left:-9999px;}',
    '.skip-link:focus{left:0;top:0;padding:.75rem;background:var(--surface);z-index:10;}',
    'input,button,select,textarea{font:inherit;border-radius:var(--radius);}',
    'button{background:var(--accent);color:var(--surface);border:0;padding:.6rem 1.2rem;cursor:pointer;}',
    'label{display:block;margin-top:.75rem;}',
    'input{display:block;width:100%;padding:.5rem;margin-top:.25rem;}',
    'ul{padding-left:1.25rem;}',
    '[data-placeholder]{background:color-mix(in srgb,var(--foreground) 12%,transparent);',
    'aspect-ratio:16/9;border-radius:var(--radius);}',
    '[data-consent-required]{border:1px dashed var(--foreground);padding:1rem;border-radius:var(--radius);}',
    // Bewegung nur, wenn der Nutzer sie nicht abbestellt hat (WCAG 2.3.3).
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}',
  ].join('');
}

// ─────────────────────────────────────────────────────────────────────
// Kontrast (WCAG 2.2 — 1.4.3)
// ─────────────────────────────────────────────────────────────────────

/**
 * Relative Luminanz nach WCAG-Definition. Nur für Hex-Farben — die
 * funktionalen Schreibweisen müssten dafür erst aufgelöst werden.
 * `null` heißt „nicht bestimmbar", nicht „schlecht".
 */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (rgb === null) return null;

  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Kontrastverhältnis zweier Hex-Farben (1–21); `null` wenn nicht bestimmbar. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;

  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Erfüllt das Farbpaar WCAG AA? 4.5:1 für Fließtext, 3:1 für großen Text.
 * `null` (nicht bestimmbar) gilt als nicht bestanden — im Zweifel wird
 * hingeschaut, statt durchgewunken.
 */
export function meetsWcagAA(foreground: string, background: string, largeText = false): boolean {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) return false;
  return ratio >= (largeText ? 3 : 4.5);
}

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim();
  if (!HEX_COLOR.test(raw)) return null;

  let hex = raw.slice(1);
  // Kurzform #rgb auf #rrggbb aufziehen.
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  // Alphakanal für die Luminanz ignorieren.
  if (hex.length === 8) hex = hex.slice(0, 6);

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}
