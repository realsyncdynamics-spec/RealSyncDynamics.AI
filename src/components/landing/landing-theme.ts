/**
 * Landing-Palette — TS-Spiegel des Enterprise Visual System.
 *
 * Die Quelle der Farben ist `src/index.css` (`:root { --rs-* }`). Diese
 * Konstanten spiegeln sie als feste Werte, weil drei Abnehmer keine
 * CSS-Variable lesen können: three.js-Materialien (Globus), SVG-Attribute
 * und die Schreibweise `` `${LANDING_ACCENT}47` `` (Hex plus Deckung), die
 * an rund zwanzig Stellen steht. Wer hier einen Wert ändert, ändert ihn
 * zuerst in `index.css` — `test/landing/landing-visual-system.test.ts`
 * hält beide Seiten gleich.
 *
 * Farbbalance (Spezifikation 2026-09-21): 85–90 % Titan/Graphit/Silber,
 * 10–15 % Governance-Cyan. Cyan ist Funktionsakzent (aktiv, gewählt,
 * Primär-CTA, Datenpfade), keine Dekoration.
 */

// ── Flächen ─────────────────────────────────────────────────────────────
export const LANDING_BG = '#080B0F';
export const LANDING_BG_SECONDARY = '#0D1218';
export const LANDING_PANEL = '#121922';
export const LANDING_PANEL_ELEVATED = '#18212B';
export const LANDING_BORDER = '#26323D';
/** Feine Linie auf dunkler Fläche — Stahl mit 16 % Deckung. */
export const LANDING_LINE = 'rgba(148, 163, 184, 0.16)';

// ── Text ────────────────────────────────────────────────────────────────
export const LANDING_TEXT = '#F2F5F7';
export const LANDING_MUTED = '#A8B3BD';
export const LANDING_MUTED_DEEP = '#707E8B';
export const LANDING_SILVER = '#CBD5DC';

// ── Akzent: Governance-Cyan ─────────────────────────────────────────────
export const LANDING_ACCENT = '#22D3EE';
export const LANDING_ACCENT_SOFT = '#67E8F9';
export const LANDING_ACCENT_DEEP = '#0891B2';
/** Helle Stufe des Akzents: Titan-Silber, kein drittes Cyan. */
export const LANDING_ACCENT_LITE = LANDING_SILVER;

// ── Semantik ────────────────────────────────────────────────────────────
export const LANDING_GREEN = '#34D399';
export const LANDING_WARNING = '#F5B942';
export const LANDING_CRITICAL = '#F06464';

// ── Schaltflächen ───────────────────────────────────────────────────────
export const LANDING_BUTTON = LANDING_ACCENT;
export const LANDING_BUTTON_ALT = LANDING_ACCENT_SOFT;
export const LANDING_BUTTON_TEXT = LANDING_BG;
/** Kein Dauerleuchten: eine Kontur plus Tiefe, mehr nicht. */
export const LANDING_CTA_GLOW =
  '0 0 0 1px rgba(34, 211, 238, 0.28), 0 8px 24px rgba(0, 0, 0, 0.35)';

// ── Typografie ──────────────────────────────────────────────────────────
/** Geist — selbst gehostet (`public/fonts/geist-*`), Inter als Rückfall. */
export const LANDING_SANS =
  "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
/** Überschriften laufen in derselben Familie — Hierarchie statt Schriftwechsel. */
export const LANDING_DISPLAY = LANDING_SANS;
/**
 * @deprecated Kein Serif mehr auf der Landing. Der Name bleibt, damit
 * bestehende Importe weiter bauen; der Wert ist die Display-Schrift.
 */
export const LANDING_SERIF = LANDING_DISPLAY;
export const LANDING_MONO = "'JetBrains Mono', 'DM Mono', ui-monospace, monospace";

export const LANDING_TRUST_MARKS = [
  'EU AI ACT READY',
  'ISO 42001 ALIGNED',
  'DSGVO FIRST',
  'AUDIT TRAIL NATIVE',
] as const;

// ── Skala ───────────────────────────────────────────────────────────────
/** Hero: 4–5.5 rem ab Desktop, auf dem Telefon ab 2.75 rem — nie starre 88 px. */
export const LANDING_H1 = 'clamp(2.75rem, 1.5rem + 4.5vw, 5.5rem)';
export const LANDING_H1_WEIGHT = 600;
export const LANDING_H1_LEADING = 0.98;
export const LANDING_H1_TRACKING = '-0.04em';
export const LANDING_H2 = 'clamp(2rem, 1.2rem + 2.6vw, 3.5rem)';
export const LANDING_H2_LG = LANDING_H2;
export const LANDING_H2_WEIGHT = 600;
export const LANDING_H2_TRACKING = '-0.03em';
export const LANDING_BODY = 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)';
export const LANDING_NAV = '0.875rem';
export const LANDING_EYEBROW = '0.75rem';
export const LANDING_EYEBROW_TRACKING = '0.12em';
export const LANDING_META = '0.625rem';
