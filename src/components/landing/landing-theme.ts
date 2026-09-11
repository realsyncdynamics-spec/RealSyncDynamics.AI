/**
 * Gestaltungswerke der öffentlichen Ebene (Dominik cyan night-map Referenz).
 *
 * ## Warum diese Datei existiert
 *
 * Der Design-Freeze (`CLAUDE.md` §10) erlaubt Ergänzungen ohne Rückfrage —
 * aber ausschliesslich „mit den vorhandenen Komponenten, Klassen und
 * Tokens". Neue Seiten des Trichters (`/scan`, `/scan/ergebnis`) brauchen
 * deshalb dieselben Werte wie die Startseite, und zwar nachweislich
 * dieselben, nicht ungefähr passende.
 *
 * Tokens spiegeln die Cyan-Referenz (`#05070b` / `#00E5FF` / Playfair / Inter).
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
export const LANDING_TEXT = '#ffffff';

/** Gedämpfter Text. */
export const LANDING_MUTED = '#a8b0bc';

/** Primärakzent — Dominik Cyan. */
export const LANDING_ACCENT = '#00E5FF';

/** Flächenfarbe der Hauptschaltfläche (Cyan). */
export const LANDING_BUTTON = '#00E5FF';

/** Alternate CTA fill (header). */
export const LANDING_BUTTON_ALT = '#00E5FF';

/** Schrift auf der Hauptschaltfläche. */
export const LANDING_BUTTON_TEXT = '#05070b';

/** Status-Grün (ok). */
export const LANDING_GREEN = '#20d69a';

/** Haarlinie. */
export const LANDING_LINE = 'rgba(0, 229, 255, 0.18)';
