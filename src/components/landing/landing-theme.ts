/**
 * Gestaltungswerte der öffentlichen Ebene — Single Source of Truth.
 *
 * ## Warum diese Datei existiert
 *
 * Der Design-Freeze (`CLAUDE.md` §10) erlaubt Ergänzungen ohne Rückfrage —
 * aber ausschliesslich „mit den vorhandenen Komponenten, Klassen und
 * Tokens". Neue Abschnitte der öffentlichen Ebene brauchen deshalb dieselben
 * Werte wie die Startseite, und zwar nachweislich dieselben, nicht ungefähr
 * passende.
 *
 * ## Was sich am 2026-09-06 geändert hat
 *
 * Frühere Fassungen hielten hier Kopien der Hex-Werte aus
 * `src/pages/MainLanding.tsx` und schrieben dazu, das Zusammenführen sei „ein
 * sinnvoller Folgeschritt — nach Freigabe". Die Freigabe liegt vor (Frage 2
 * der Drei-Fragen-Regel, §10.4), der Schritt ist vollzogen:
 *
 * - Die Farben sind echte Tailwind-Tokens (`champagne-*`, `obsidian-deep`,
 *   `font-serif`) statt Hex-Literale in einer einzelnen Komponente.
 * - `MainLanding.tsx` liest sie von hier, statt sie ein zweites Mal zu
 *   definieren. Es gibt damit keine zwei Stellen mehr, die auseinanderlaufen
 *   könnten — der Grund für die frühere Warnung ist entfallen.
 *
 * ## Zwei Befunde, die dabei sichtbar wurden
 *
 * **1. Der zugesagte Wächter existierte nicht.** Diese Datei behauptete,
 * `test/scan/landing-theme.test.ts` halte sie mit `MainLanding.tsx` zusammen.
 * Weder der Test noch das Verzeichnis `test/scan/` existierten. Die Zusage
 * stand vier Wochen ungedeckt da. Sie ist jetzt eingelöst, aber an der
 * richtigen Stelle und mit der richtigen Frage:
 * `test/landing/landing-theme.test.ts` prüft, dass diese Werte den Tokens in
 * `tailwind.config.ts` entsprechen.
 *
 * **2. Die Datei hatte null Konsumenten.** Sie war für `/scan` und
 * `/scan/ergebnis` angelegt worden; `/scan` ist per Freigabe vom 2026-08-23
 * auf `/audit` umgestellt worden, und die Werte wurden nie irgendwo gelesen.
 *
 * ## Regel
 *
 * Wer einen Wert hier ändert, ändert das Aussehen der ausgelieferten
 * Startseite. Das fällt unter §10.1 und ist ohne Freigabe untersagt. Wer
 * einen Wert *hinzufügt*, muss ihn auch in `tailwind.config.ts` eintragen —
 * sonst schlägt `test/landing/landing-theme.test.ts` fehl.
 */

/** Hintergrund der öffentlichen Ebene. Tailwind: `bg-obsidian-deep`. */
export const LANDING_BG = 'rgb(3, 7, 18)';

/** Fliesstext und Oberfläche. Tailwind: `font-sans`. */
export const LANDING_SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

/** Überschriften. Tailwind: `font-serif`. */
export const LANDING_SERIF = "Georgia, 'Times New Roman', serif";

/** Akzentfarbe für Auszeichnungen, Linien und Marken-Details. `text-champagne`. */
export const LANDING_ACCENT = '#e8c98a';

/** Flächenfarbe der Hauptschaltfläche. `bg-champagne-200`. */
export const LANDING_BUTTON = '#f0e6d2';

/** Schrift auf der Hauptschaltfläche. `text-champagne-950`. */
export const LANDING_BUTTON_TEXT = '#1a1714';

/**
 * Die vollständige Champagner-Skala, wie `tailwind.config.ts` sie führt.
 *
 * Getrennt von den Einzelkonstanten oben, weil die einen Zweck benennen
 * („Fläche der Hauptschaltfläche") und diese eine Stufe („200"). Der Test
 * vergleicht diese Abbildung gegen die Tailwind-Konfiguration.
 */
export const CHAMPAGNE_SCALE = {
  50: '#fff8ee',
  100: '#f6efe4',
  200: '#f0e6d2',
  300: '#e8dcc4',
  400: '#f3d9a0',
  500: '#e8c98a',
  950: '#1a1714',
} as const;

/**
 * Wiederkehrende Schaltflächen-Formen der öffentlichen Ebene.
 *
 * Damit ein neuer Abschnitt nicht seine eigene Optik erfindet (§10.2: „Wer
 * etwas hinzufügt, erfindet dafür keine neue Optik"). Die Werte sind aus den
 * bestehenden Schaltflächen der Startseite abgelesen, nicht neu gewählt.
 */
export const LANDING_BUTTON_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-full bg-champagne-200 px-7 py-3.5 font-semibold text-champagne-950 transition hover:bg-champagne-100';

export const LANDING_BUTTON_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-full border border-champagne/45 px-7 py-3.5 font-medium text-champagne-50 transition hover:bg-white/5';

/** Kleine Auszeichnung über einer Abschnitts-Überschrift („DIE PLATTFORM"). */
export const LANDING_EYEBROW = 'font-mono text-[10px] tracking-[.25em] text-champagne';
