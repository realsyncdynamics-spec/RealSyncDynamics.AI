/**
 * Gestaltungswerte der öffentlichen Ebene (Dominik Dark / Gold / Cream).
 *
 * ## Warum diese Datei existiert
 *
 * Der Design-Freeze (`CLAUDE.md` §10) erlaubt Ergänzungen ohne Rückfrage —
 * aber ausschliesslich „mit den vorhandenen Komponenten, Klassen und
 * Tokens". Neue Seiten des Trichters (`/scan`, `/scan/ergebnis`) brauchen
 * deshalb dieselben Werte wie die Startseite, und zwar nachweislich
 * dieselben, nicht ungefähr passende.
 *
 * Tokens spiegeln die Referenz (`#05070b` / `#e4cfa2` / cream CTAs /
 * Playfair / DM Mono). `MainLanding.tsx` konsumiert dieselben Konstanten.
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

/** Primärtext (Cream). */
export const LANDING_TEXT = '#f2eee6';

/** Gedämpfter Text. */
export const LANDING_MUTED = '#9a9aa1';

/** Akzentfarbe — muted metallic Gold. */
export const LANDING_ACCENT = '#e4cfa2';

/** Flächenfarbe der Hauptschaltfläche (Cream). */
export const LANDING_BUTTON = '#e8ddc8';

/** Alternate cream (header CTA) — kept darker than paper-white. */
export const LANDING_BUTTON_ALT = '#e8ddc8';

/** Schrift auf der Hauptschaltfläche. */
export const LANDING_BUTTON_TEXT = '#1a1917';

/** Status-Grün (ok). */
export const LANDING_GREEN = '#20d69a';

/** Haarlinie. */
export const LANDING_LINE = 'rgba(220, 210, 190, 0.18)';

/**
 * Fluid type scales — desktop-first hierarchy, still ≤2-line H1.
 * Caps stay below the old 72px orphan; floor is readable on mobile.
 */
export const LANDING_H1 = 'clamp(2.125rem, 1.15rem + 3.6vw, 3.5rem)'; // ~34–56px
export const LANDING_H2 = 'clamp(1.875rem, 1.15rem + 2.4vw, 2.875rem)'; // ~30–46px
export const LANDING_H2_LG = 'clamp(1.95rem, 1.2rem + 2.6vw, 3rem)'; // section display
/** Body / claim under H1 */
export const LANDING_BODY = 'clamp(0.9375rem, 0.88rem + 0.25vw, 1.0625rem)'; // ~15–17px
/** Mono loop / eyebrows */
export const LANDING_EYEBROW = '0.6875rem'; // 11px
export const LANDING_META = '0.625rem'; // 10px
