/**
 * Single Source of Truth für die Hero-Headline der Startseite.
 *
 * Warum: Die E2E-Suite prüft über die Headline, dass auf `/` wirklich die
 * Startseite rendert (FE-001, tests/e2e/public-routes.spec.ts) — nicht nur
 * der SPA-Fallback. Zwischen dem 13.08. und 16.08. brach dieser Test dreimal,
 * weil Landing-Umbauten die Headline änderten, ohne den Test mitzuziehen.
 *
 * Deshalb leben Headline UND Test-Erwartung jetzt hier. Wer die Headline
 * ändert, ändert diese Datei — Rendering und Test folgen automatisch.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → wird in der Akzentfarbe (cyan) gerendert. */
  accent?: boolean;
};

/** Die H1, zeilenweise (Zeilen werden mit <br /> getrennt gerendert). */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'Das KI-Betriebssystem' }],
  [{ text: 'für ' }, { text: 'DSGVO, EU AI Act', accent: true }],
  [{ text: '& Code-Compliance', accent: true }],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join('')
);

/**
 * Substring für den FE-001-Check. MUSS vollständig innerhalb EINER Zeile
 * liegen: die <br />-Umbrüche fließen in den Accessible Name der H1 ein,
 * ein zeilenübergreifender Substring würde nicht matchen.
 */
export const HERO_HEADLINE_TEST_SUBSTRING = 'Das KI-Betriebssystem';

// Wächter gegen künftige Umbauten: Substring muss in einer Zeile stecken —
// sonst schlägt FE-001 fehl, obwohl die Seite korrekt rendert.
if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der ' +
      'HERO_HEADLINE vor — FE-001 würde fehlschlagen.'
  );
}
