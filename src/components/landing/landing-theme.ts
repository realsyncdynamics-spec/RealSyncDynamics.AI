/**
 * Gestaltungswerte der öffentlichen Ebene (Sovereign Night — Dark / Gold / Cream).
 *
 * ## Warum diese Datei existiert
 *
 * Der Design-Freeze (`CLAUDE.md` §10) erlaubt Ergänzungen ohne Rückfrage —
 * aber ausschliesslich „mit den vorhandenen Komponenten, Klassen und
 * Tokens". Neue Seiten des Trichters (`/scan`, `/scan/ergebnis`) brauchen
 * deshalb dieselben Werte wie die Startseite, und zwar nachweislich
 * dieselben, nicht ungefähr passende.
 *
 * Tokens: tiefer Void-Hintergrund, helleres Cream, institutionelles Gold
 * (weniger Gelb), Cream-CTAs `#e8ddc8` (nie Weiss als Primary).
 * Playfair / DM Mono. `MainLanding.tsx` konsumiert dieselben Konstanten.
 */

/** Hintergrund der öffentlichen Ebene — tiefer Void. */
export const LANDING_BG = '#02040a';

/** Panel-/Kartenfläche. */
export const LANDING_PANEL = '#080b12';

/** Fliesstext und Oberfläche. */
export const LANDING_SANS = "'Inter', system-ui, sans-serif";

/** Überschriften — Playfair Display (self-hosted). */
export const LANDING_SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

/** Eyebrows / Labels — DM Mono (self-hosted). */
export const LANDING_MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";

/** Primärtext — helleres Cream (nicht Papierweiss). */
export const LANDING_TEXT = '#f6f2e9';

/** Gedämpfter Text. */
export const LANDING_MUTED = '#a3a3aa';

/** Akzentfarbe — institutionelles Gold (weniger Gelb als Schmuck-Gold). */
export const LANDING_ACCENT = '#d0c3a4';

/** Flächenfarbe der Hauptschaltfläche (Cream). */
export const LANDING_BUTTON = '#e8ddc8';

/** Alternate cream (header CTA) — kept darker than paper-white. */
export const LANDING_BUTTON_ALT = '#e8ddc8';

/** Schrift auf der Hauptschaltfläche. */
export const LANDING_BUTTON_TEXT = '#1a1917';

/** Status-Grün (ok). */
export const LANDING_GREEN = '#20d69a';

/** Haarlinie. */
export const LANDING_LINE = 'rgba(208, 195, 164, 0.18)';

/**
 * Fluid type scales — hero-first hierarchy for Sovereign Night Earth landing.
 * Cap stays viewport-safe; DE H1 (≤2 lines) must still fit viewport width.
 */
export const LANDING_H1 = 'clamp(2rem, 1.2rem + 3.4vw, 3.25rem)'; // ~32–52px
export const LANDING_H2 = 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)'; // ~29–44px
export const LANDING_H2_LG = 'clamp(1.9rem, 1.2rem + 2.5vw, 2.875rem)'; // section display
/** Body / motto / scan promise under H1 */
export const LANDING_BODY = 'clamp(1rem, 0.92rem + 0.35vw, 1.125rem)'; // ~16–18px
/** Mono loop / eyebrows */
export const LANDING_EYEBROW = '0.6875rem'; // 11px
/** Meta / kicker / fine print */
export const LANDING_META = '0.625rem'; // 10px
