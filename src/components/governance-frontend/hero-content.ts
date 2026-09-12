/**
 * Single Source of Truth für die Hero-Headline der Startseite.
 *
 * Die Headline wird von der öffentlichen Startseite und dem FE-001-Check
 * gemeinsam verwendet. Änderungen deshalb ausschließlich hier vornehmen.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → Gold-Akzent (Playfair italic in der Referenz). */
  accent?: boolean;
};

/**
 * Governance OS Hero — Dominik-Referenz.
 *
 * Two lines max on desktop — no orphan “Time”. Fluid type on MainLanding
 * (`LANDING_H1`) keeps the wrap balanced across viewports.
 */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Governance,' }],
  [{ text: 'Running in Real Time', accent: true }],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join('')
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'AI Governance';

/** Motto under the H1 — Detect.Govern.Prove.Automate */
export const HERO_OPERATING_LOOP = 'Detect · Govern · Prove · Automate' as const;

if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der ' +
      'HERO_HEADLINE vor — FE-001 würde fehlschlagen.'
  );
}

if (HERO_HEADLINE_LINES.length > 2) {
  throw new Error('hero-content.ts: H1 must stay ≤ 2 lines (no orphan “Time”).');
}
