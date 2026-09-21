/**
 * Farbtoken der Startseite als CSS-Variablen.
 *
 * ## Ein System, kein Schalter
 *
 * Bis 2026-09-20 ließ sich die Startseite zwischen Gold und Cyan
 * umschalten. Das Enterprise Visual System kennt nur eine Palette:
 * Titan/Graphit als Grund, Governance-Cyan als Funktionsakzent. Der
 * Schalter ist entfallen; die Konstanten hier bleiben, weil Hero, Kopf und
 * Netzgrafik sie lesen — sie zeigen jetzt auf die `--rsd-*`-Variablen, die
 * `src/index.css` auf dem Seiten-Wrapper aus den `--rs-*`-Token ableitet.
 *
 * ## Warum Variablen und keine Hex-Werte
 *
 * `landing-theme.ts` spiegelt dieselben Werte fest für Abnehmer, die keine
 * Variable lesen können (three.js, SVG-Attribute, Hex-plus-Deckung). Hero
 * und Kopf brauchen das nicht und lesen die Variable; der Rückfall im
 * `var()` ist der Spiegelwert, damit die Fläche auch ohne Wrapper-Klasse
 * richtig getont bleibt.
 */

export const MODE_ACCENT = 'var(--rsd-accent, #22D3EE)';
export const MODE_ACCENT_SOFT = 'var(--rsd-accent-soft, #67E8F9)';
export const MODE_ACCENT_LITE = 'var(--rsd-accent-lite, #CBD5DC)';
/** Titan-Silber — Linien, Netzkanten, Sekundärkonturen. */
export const MODE_STEEL = 'var(--rsd-steel, #CBD5DC)';
export const MODE_BG = 'var(--rsd-bg, #080B0F)';
export const MODE_PANEL = 'var(--rsd-panel, #121922)';
export const MODE_BUTTON_INK = 'var(--rsd-btn-ink, #080B0F)';
export const MODE_LINE = 'var(--rsd-line, rgba(148, 163, 184, 0.16))';
export const MODE_GLOW =
  'var(--rsd-glow, 0 0 0 1px rgba(34, 211, 238, 0.28), 0 8px 24px rgba(0, 0, 0, 0.35))';
export const MODE_VEIL = 'var(--rsd-veil, #080B0F)';
export const MODE_SHOT_OPACITY = 'var(--rsd-shot-opacity, 0.62)';
export const MODE_SHOT_FILTER =
  'var(--rsd-shot-filter, grayscale(0.4) saturate(0.6) brightness(0.7) contrast(1.12))';

/**
 * Akzent mit Deckung.
 *
 * Ersetzt die Schreibweise `` `${LANDING_ACCENT}47` ``, die einen festen
 * Hex-Wert voraussetzt und an einer CSS-Variablen still zu einer
 * ungültigen Farbe würde — also zu einem unsichtbaren Rahmen, ohne Fehler.
 *
 * @param percent Deckung in Prozent (0–100).
 */
export function modeAccent(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT} ${percent}%, transparent)`;
}

/** Dasselbe für den hellen Akzent. */
export function modeAccentSoft(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT_SOFT} ${percent}%, transparent)`;
}

/** Stahl mit Deckung — für Kanten, die nicht leuchten sollen. */
export function modeSteel(percent: number): string {
  return `color-mix(in srgb, ${MODE_STEEL} ${percent}%, transparent)`;
}

/** Deckender Schleier über der Aufnahme — hält die linke Spalte lesbar. */
export function modeVeil(percent: number): string {
  return `color-mix(in srgb, ${MODE_VEIL} ${percent}%, transparent)`;
}
