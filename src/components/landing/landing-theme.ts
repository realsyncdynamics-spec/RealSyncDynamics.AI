/**
 * Gestaltungswerte der öffentlichen Ebene (Dominik-Referenz / Dark–Titanium–Gold).
 *
 * ## Warum diese Datei existiert
 *
 * Der Design-Freeze (`CLAUDE.md` §10) erlaubt Ergänzungen ohne Rückfrage —
 * aber ausschliesslich „mit den vorhandenen Komponenten, Klassen und
 * Tokens". Neue Seiten des Trichters (`/scan`, `/scan/ergebnis`) brauchen
 * deshalb dieselben Werte wie die Startseite, und zwar nachweislich
 * dieselben, nicht ungefähr passende.
 *
 * Tokens spiegeln die Referenz (`#05070b` / `#e4cfa2` / Playfair / DM Mono).
 * `MainLanding.tsx` konsumiert dieselben Konstanten.
 */

/** Hintergrund der öffentlichen Ebene. */
export const LANDING_BG = '#05070b';

/** Panel-/Kartenfläche. */
export const LANDING_PANEL = '#0b0e14';

/** Fliesstext und Oberfläche. */
export const LANDING_SANS = "'Inter', system-ui, sans-serif";

/** Überschriften — Playfair Display (self-hosted). */
export const LANDING_SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

/** Eyebrows / Labels — DM Mono (self-hosted). */
export const LANDING_MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";

/** Primärtext. */
export const LANDING_TEXT = '#f2eee6';

/** Gedämpfter Text. */
export const LANDING_MUTED = '#9a9aa1';

/** Akzentfarbe für Auszeichnungen, Linien und Marken-Details. */
export const LANDING_ACCENT = '#e4cfa2';

/** Flächenfarbe der Hauptschaltfläche (Cream). */
export const LANDING_BUTTON = '#e8ddc8';

/** Alternate cream (header CTA). */
export const LANDING_BUTTON_ALT = '#efe6d5';

/** Schrift auf der Hauptschaltfläche. */
export const LANDING_BUTTON_TEXT = '#1a1917';

/** Soft cream/gold glow for primary scan CTA (monetization lead-magnet). */
export const LANDING_CTA_GLOW =
  '0 0 24px rgba(232, 221, 200, 0.28), 0 0 48px rgba(228, 207, 162, 0.12)';

/** Status-Grün (ok). */
export const LANDING_GREEN = '#20d69a';

/** Haarlinie. */
export const LANDING_LINE = 'rgba(220, 210, 190, 0.18)';

/** Thin header trust marks — honest standards only, no SLA/uptime claims. */
export const LANDING_TRUST_MARKS = ['DSGVO', 'EU AI Act', 'Evidence-ready'] as const;

/**
 * Fluid type scales — shared by public sections + OS chrome.
 * Hero H1 on `/` uses clamp in MainLanding (Playfair Dominik reference).
 */
export const LANDING_H1 = 'clamp(2.15rem, 1.25rem + 3.6vw, 3.75rem)';
export const LANDING_H2 = 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)';
export const LANDING_H2_LG = 'clamp(1.9rem, 1.2rem + 2.5vw, 2.875rem)';
export const LANDING_BODY = 'clamp(1rem, 0.92rem + 0.35vw, 1.125rem)';
export const LANDING_EYEBROW = '0.75rem';
export const LANDING_META = '0.625rem';
