/**
 * Single Source of Truth für die Hero-Headline der Startseite.
 *
 * Die Headline wird von der öffentlichen Startseite (`src/pages/MainLanding.tsx`)
 * und dem FE-001-Check (`tests/e2e/public-routes.spec.ts`) gemeinsam verwendet.
 * Änderungen deshalb ausschließlich hier vornehmen — zwischen dem 13.08. und
 * 16.08. brach FE-001 mehrfach, weil Landing-Umbauten die Headline direkt im
 * JSX änderten und diese Datei verwaiste.
 */

/** Erster Teil der H1 — normale Textfarbe. */
export const HERO_HEADLINE_MAIN = 'Sichern Sie die Zukunft Ihres';

/** Zweiter Teil der H1 — Akzentfarbe (cyan). */
export const HERO_HEADLINE_ACCENT = 'KI-gesteuerten Unternehmens.';

/** Vollständiger Accessible Name der H1 (Segmente mit Leerzeichen verbunden). */
export const HERO_HEADLINE_FULL = `${HERO_HEADLINE_MAIN} ${HERO_HEADLINE_ACCENT}`;

/** Substring für den FE-001-Check. Muss vollständig in HERO_HEADLINE_FULL liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'Sichern Sie die Zukunft';

if (!HERO_HEADLINE_FULL.includes(HERO_HEADLINE_TEST_SUBSTRING)) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in der HERO_HEADLINE ' +
      'nicht vor — FE-001 würde fehlschlagen.'
  );
}
