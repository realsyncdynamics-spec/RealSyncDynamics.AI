/**
 * Single Source of Truth für die Hero-Headline der Startseite.
 *
 * Die Headline wird von der öffentlichen Startseite (src/pages/MainLanding.tsx)
 * und dem FE-001-Check gemeinsam verwendet. Änderungen deshalb ausschließlich
 * hier vornehmen.
 *
 * WARUM DAS WICHTIG IST: Diese Datei nennt sich Single Source of Truth, war es
 * aber dreimal nicht — zuletzt hatte sie überhaupt keinen Produktions-
 * Konsumenten mehr und speiste nur noch die Tests. Jedes Mal lief der Test
 * danach gegen eine Headline, die die Seite nie gerendert hat, und main war
 * rot. Wer die H1 im JSX hartkodiert, bricht FE-001 beim nächsten Umbau
 * erneut.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → wird in der Akzentfarbe (cyan) gerendert. */
  accent?: boolean;
};

/** Governance-Level Hero — Positionierung v4 (Scan-First-Landing, 2026-08-16). */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [
    { text: 'Sichern Sie die Zukunft Ihres ' },
    { text: 'KI-gesteuerten Unternehmens.', accent: true },
  ],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join('')
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'Sichern Sie die Zukunft';

if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der ' +
      'HERO_HEADLINE vor — FE-001 würde fehlschlagen.'
  );
}
