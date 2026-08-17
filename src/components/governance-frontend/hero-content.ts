/**
 * Single Source of Truth für die Hero-Headline der Startseite.
 *
 * Die Headline wird von der öffentlichen Startseite und dem FE-001-Check
 * gemeinsam verwendet. Änderungen deshalb ausschließlich hier vornehmen.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → wird in der Akzentfarbe (cyan) gerendert. */
  accent?: boolean;
};

/**
 * Governance-Level Hero — Positionierung v4 (Enterprise-Hero, 2026-08-17).
 *
 * ## Warum diese Datei neunmal wirkungslos war
 *
 * Sie nannte sich Single Source of Truth, hatte aber **keinen einzigen
 * Produktions-Konsumenten**: Die H1 stand hartkodiert in `MainLanding.tsx`,
 * gelesen wurde `HERO_HEADLINE` nur von den E2E-Tests. Jeder Landing-Umbau,
 * der diese Datei nicht mitpflegte, ließ FE-001 auffliegen — neunmal.
 *
 * Seit v4 rendert die Startseite die H1 aus `HERO_HEADLINE`. Damit ist der
 * Kreis geschlossen: Wer die Headline ändert, ändert sie hier, und Seite wie
 * Test folgen automatisch.
 */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'Das KI-Betriebssystem' }],
  [{ text: 'für DSGVO, EU AI Act', accent: true }],
  [{ text: '& Code-Compliance', accent: true }],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join('')
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'Das KI-Betriebssystem';

if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der ' +
      'HERO_HEADLINE vor — FE-001 würde fehlschlagen.'
  );
}
