/**
 * Governance-AI-Landing — Design-Tokens der TITAN-Variante.
 *
 * ## Verhältnis zu `landing-theme.ts`
 *
 * `landing-theme.ts` bleibt die Basis für alle öffentlichen Flächen
 * (`/branchen`, `/scan`, …) und ist unverändert. Diese Datei setzt
 * ausschließlich die Palette der Startseite darüber: gebürstetes Titan
 * statt Nachtblau, Champagner-Gold (`#c9a24a`) statt Cream (`#e4cfa2`),
 * Inter Tight als Display-Schnitt statt Playfair.
 *
 * Die Werte stammen 1:1 aus dem finalen Design-Prototyp
 * (`The Governance AI.html`, Titan-Variante) — der Champagner-Ton war
 * Dominiks letzte Farbentscheidung („Gold zu kühlem Champagner-Gold …
 * wirkt institutioneller"), nicht das ältere Orange-Bronze früherer
 * Iterationen.
 *
 * Keine Preise, keine Copy, keine Limits — alles inhaltliche kommt aus den
 * SSoT-Dateien (`hero-content.ts`, `pricing.ts`, `implementation-status.ts`,
 * `runtimeVocab.ts`, `public-nav.ts`, `governanceModules.ts`).
 */

/** Schriftfamilien — Basis-Stack aus `landing-theme.ts` weiterverwendet. */
export { LANDING_SANS as GA_SANS, LANDING_MONO as GA_MONO } from './landing-theme';

/** Display-Schnitt: Inter Tight, self-hosted (siehe `src/index.css`). */
export const GA_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";

// ── Flächen ─────────────────────────────────────────────────────────────
export const GA_VOID = '#0f1012';
export const GA_DEEP = '#1c1e21';
export const GA_MID = '#2a2d31';
export const GA_PANEL = 'rgba(24, 26, 29, 0.72)';

// ── Text ────────────────────────────────────────────────────────────────
export const GA_TEXT = '#f3f5f8';
export const GA_MUTED = '#a3acb8';
export const GA_TITAN = '#8a929c';
export const GA_SILVER = '#d9dee5';

// ── Akzent: Champagner-Gold ─────────────────────────────────────────────
export const GA_GOLD = '#c9a24a';
export const GA_GOLD_LITE = '#e6c98a';
export const GA_GOLD_DEEP = '#8a6a24';

/** Status-Grün — ausschließlich für Betriebssignale, nie als Akzentfarbe. */
export const GA_GREEN = '#35d0a8';

// ── Linien ──────────────────────────────────────────────────────────────
export const GA_LINE = 'rgba(217, 222, 229, 0.16)';
export const GA_LINE_SOFT = 'rgba(217, 222, 229, 0.09)';

// ── Verläufe ────────────────────────────────────────────────────────────

/** Goldsiegel-Fläche der Primär-Pills (Header-CTA, Hero, Enterprise). */
export const GA_GOLD_FACE = 'linear-gradient(180deg, #f2dca4 0%, #d3ad55 48%, #a8842c 100%)';

export const GA_GOLD_FACE_SHADOW =
  'inset 0 1px 0 rgba(255,255,255,.6), inset 0 -2px 0 rgba(0,0,0,.18), 0 0 0 1px rgba(255,236,190,.35), 0 12px 30px rgba(0,0,0,.45), 0 0 30px rgba(211,173,85,.22)';

/** Silber-Verlauf der H1 — hell oben, Titan unten. */
export const GA_SILVER_TEXT = 'linear-gradient(180deg, #ffffff 0%, #e9ecf0 48%, #b7bcc4 100%)';

/** Gold-Verlauf für Akzentworte in der H1 („for Europe"). */
export const GA_GOLD_TEXT = 'linear-gradient(180deg, #f4e0b0 0%, #d3ad55 50%, #a8842c 100%)';

/** Gold-Verlauf für Akzentworte in H2 — helle Stopps links, Tiefe rechts. */
export const GA_GOLD_TEXT_H2 =
  'linear-gradient(116deg, #f7ecd6 0%, #e6c98a 34%, #c9a24a 64%, #8a6a24 88%)';

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
  'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-[28px] py-[15px] text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6c98a] hover:brightness-[1.06]';

export const GA_PILL_GHOST =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[rgba(214,220,228,0.4)] bg-[rgba(18,28,38,0.66)] px-[26px] py-[14px] text-[14px] font-medium text-[#f3f5f8] backdrop-blur-[8px] transition hover:border-[#d9dee5] hover:bg-[rgba(214,220,228,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9dee5]/60';

export const GA_EYEBROW_PILL =
  'inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-[rgba(201,162,74,0.42)] bg-[rgba(18,28,38,0.6)] px-[13px] py-[7px] text-[11px] tracking-[.2em] text-[#e6c98a] backdrop-blur-[6px]';

/** Hairline-Grid der Enterprise-/Kennzahlen-Raster (1px-Fugen über Bg). */
export const GA_HAIRLINE_GRID = 'gap-px border bg-[rgba(217,222,229,0.09)]';
