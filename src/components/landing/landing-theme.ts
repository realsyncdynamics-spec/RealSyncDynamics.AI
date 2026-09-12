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

/** Akzentfarbe — warmes Mockup-Gold (Europe + Netzwerk + Cream-CTAs). */
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
export const LANDING_LINE = 'rgba(228, 207, 162, 0.18)';

/**
 * Fluid type scales — Europe-OS hero (large sans, left copy + right map).
 * H1 must dominate the first viewport without orphan words.
 */
export const LANDING_H1 = 'clamp(2.15rem, 1.25rem + 3.6vw, 3.75rem)'; // ~34–60px — two lines, no wrap
export const LANDING_H2 = 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)'; // ~29–44px
export const LANDING_H2_LG = 'clamp(1.9rem, 1.2rem + 2.5vw, 2.875rem)'; // section display
/** Body / subline under H1 */
export const LANDING_BODY = 'clamp(1rem, 0.92rem + 0.35vw, 1.125rem)'; // ~16–18px
/** Mono loop / eyebrows — small caps feel */
export const LANDING_EYEBROW = '0.75rem'; // 12px
/** Meta / kicker / fine print */
export const LANDING_META = '0.625rem'; // 10px
