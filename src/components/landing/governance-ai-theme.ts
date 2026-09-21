/**
 * Governance-AI-Landing — Design-Tokens.
 *
 * ## Zwei Varianten, ein Attribut
 *
 * Die Startseite tritt in zwei Ausprägungen auf, zwischen denen der Besucher
 * umschaltet (`data-ga-theme` auf dem Seiten-Wrapper, siehe `ThemeSwitch`):
 *
 *   titan  — seit 2026-09-21 das Enterprise Visual System: Titan/Graphit
 *            als Grund, Governance-Cyan als Funktionsakzent, Geist als
 *            Display-Schnitt. Abgeleitet aus den `--rs-*`-Token. Standard
 *            beim ersten Aufruf und auf `.landing-context` ohne Attribut.
 *   night  — Schwarz, Europa als fotografische Nachtaufnahme, Cyan-Akzent,
 *            Playfair Display als Display-Schnitt (nur `/design/…`).
 *
 * ## Warum hier keine Hex-Werte mehr stehen
 *
 * Die Konstanten zeigen auf CSS-Variablen statt auf feste Farben. Dadurch
 * schaltet ein einziges Attribut die ganze Seite um — die Komponenten
 * behalten ihre bestehenden `style`-Angaben und werden trotzdem
 * themefähig. Die tatsächlichen Werte beider Paletten stehen gebündelt in
 * `src/index.css` unter `[data-ga-theme]`; wer eine Farbe ändern will,
 * ändert sie dort an genau einer Stelle für beide Varianten.
 *
 * Keine Preise, keine Copy, keine Limits — alles inhaltliche kommt aus den
 * SSoT-Dateien (`hero-content.ts`, `pricing.ts`, `implementation-status.ts`,
 * `runtimeVocab.ts`, `public-nav.ts`, `governanceModules.ts`).
 */

/** Schriftfamilien — Basis-Stack aus `landing-theme.ts` weiterverwendet. */
export { LANDING_SANS as GA_SANS, LANDING_MONO as GA_MONO } from './landing-theme';

/** Display-Schnitt: Inter Tight, self-hosted (siehe `src/index.css`). */
export const GA_DISPLAY = 'var(--ga-display)';

// ── Flächen ─────────────────────────────────────────────────────────────
export const GA_VOID = 'var(--ga-void)';
export const GA_DEEP = 'var(--ga-deep)';
export const GA_MID = 'var(--ga-mid)';
export const GA_PANEL = 'var(--ga-panel)';

// ── Text ────────────────────────────────────────────────────────────────
export const GA_TEXT = 'var(--ga-text)';
export const GA_MUTED = 'var(--ga-muted)';
export const GA_TITAN = 'var(--ga-titan)';
export const GA_SILVER = 'var(--ga-silver)';

// ── Akzent: Champagner-Gold ─────────────────────────────────────────────
export const GA_GOLD = 'var(--ga-accent)';
export const GA_GOLD_LITE = 'var(--ga-accent-lite)';
export const GA_GOLD_DEEP = 'var(--ga-accent-deep)';

/** Status-Grün — ausschließlich für Betriebssignale, nie als Akzentfarbe. */
export const GA_GREEN = 'var(--ga-green)';

// ── Linien ──────────────────────────────────────────────────────────────
export const GA_LINE = 'var(--ga-line)';
export const GA_LINE_SOFT = 'var(--ga-line-soft)';

// ── Verläufe ────────────────────────────────────────────────────────────

/** Goldsiegel-Fläche der Primär-Pills (Header-CTA, Hero, Enterprise). */
export const GA_GOLD_FACE = 'var(--ga-pill-face)';

export const GA_GOLD_FACE_SHADOW = 'var(--ga-pill-shadow)';

/** Silber-Verlauf der H1 — hell oben, Titan unten. */
export const GA_SILVER_TEXT = 'var(--ga-h1-face)';

/** Gold-Verlauf für Akzentworte in der H1 („for Europe"). */
export const GA_GOLD_TEXT = 'var(--ga-h1-accent)';

/** Gold-Verlauf für Akzentworte in H2 — helle Stopps links, Tiefe rechts. */
export const GA_GOLD_TEXT_H2 = 'var(--ga-h2-accent)';

export const GA_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// ── Typo-Skalen (aus dem Prototyp) ──────────────────────────────────────
export const GA_H1 = 'clamp(2.5rem, 1rem + 4.6vw, 5rem)';
export const GA_H2 = 'clamp(1.9rem, 1.1rem + 2.6vw, 3rem)';
export const GA_LEDE = 'clamp(1.05rem, .95rem + .45vw, 1.25rem)';

/**
 * Wiederkehrende Klassenlisten. Bewusst vollständige Literale — Tailwind
 * scannt Quelltext statisch, zusammengesetzte Klassennamen fielen sonst aus
 * dem Build.
 */
export const GA_PILL_PRIMARY =
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-[28px] py-[15px] text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-accent-lite)] hover:brightness-[1.06]';

export const GA_PILL_GHOST =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--ga-ghost-border)] bg-[var(--ga-ghost-face)] px-[26px] py-[14px] text-[14px] font-medium text-[var(--ga-text)] backdrop-blur-[8px] transition hover:border-[var(--ga-ghost-border-hover)] hover:bg-[var(--ga-ghost-face-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ga-silver)]/60';

export const GA_EYEBROW_PILL =
  'inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-[var(--ga-accent-border)] bg-[var(--ga-chip-face)] px-[13px] py-[7px] text-[11px] tracking-[.2em] text-[var(--ga-accent-lite)] backdrop-blur-[6px]';

/** Hairline-Grid der Enterprise-/Kennzahlen-Raster (1px-Fugen über Bg). */
export const GA_HAIRLINE_GRID = 'gap-px border bg-[var(--ga-line-soft)]';
