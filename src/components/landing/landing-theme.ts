/**
 * Gestaltungswerte der öffentlichen Ebene.
 *
 * ## Warum diese Datei existiert
 *
 * Der Design-Freeze (`CLAUDE.md` §10) erlaubt Ergänzungen ohne Rückfrage —
 * aber ausschliesslich „mit den vorhandenen Komponenten, Klassen und
 * Tokens". Neue Seiten des Trichters (`/scan`, `/scan/ergebnis`) brauchen
 * deshalb dieselben Werte wie die Startseite, und zwar nachweislich
 * dieselben, nicht ungefähr passende.
 *
 * ## Was hier bewusst NICHT passiert ist
 *
 * `src/pages/MainLanding.tsx` hält diese Werte weiterhin lokal. Sie hierher
 * zu ziehen wäre eine Änderung an der eingefrorenen Seite und fiele unter
 * die Fragepflicht nach §10.3 — für einen reinen Aufräumschritt ist das der
 * falsche Preis. Die Werte unten sind aus `MainLanding.tsx` übernommen und
 * müssen mit ihr übereinstimmen; `test/scan/landing-theme.test.ts` hält das
 * fest, damit die beiden Stellen nicht auseinanderlaufen.
 *
 * Zusammenführen ist ein sinnvoller Folgeschritt — nach Freigabe.
 */

/** Hintergrund der öffentlichen Ebene. */
export const LANDING_BG = 'rgb(3, 7, 18)';

/** Fliesstext und Oberfläche. */
export const LANDING_SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

/** Überschriften. */
export const LANDING_SERIF = "Georgia, 'Times New Roman', serif";

/** Akzentfarbe für Auszeichnungen, Linien und Marken-Details. */
export const LANDING_ACCENT = '#e8c98a';

/** Flächenfarbe der Hauptschaltfläche. */
export const LANDING_BUTTON = '#f0e6d2';

/** Schrift auf der Hauptschaltfläche. */
export const LANDING_BUTTON_TEXT = '#1a1714';
