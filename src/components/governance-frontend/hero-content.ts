/**
 * Single Source of Truth für die Hero-Headline der Startseite.
 *
 * Die Headline wird von der öffentlichen Startseite und dem FE-001-Check
 * gemeinsam verwendet. Änderungen deshalb ausschließlich hier vornehmen.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → Gold-Akzent („Europe“). */
  accent?: boolean;
};

/**
 * Europe-OS Hero — Dominik 1:1 luxury mock lock.
 *
 * Claim: AI Compliance Operations OS for Europe.
 *
 * ## Contract
 *
 * `MainLanding` renders H1 exclusively from `HERO_HEADLINE`. E2E / FE-001
 * read the same source — change here, not in the page.
 *
 * Two lines: line 1 ends with “for”; line 2 is gold **Europe** alone.
 */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Compliance Operations OS for' }],
  [{ text: 'Europe', accent: true }],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(''),
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'AI Compliance';

/** Operating loop — single line under the H1 (mock lock, title case). */
export const HERO_OPERATING_LOOP = 'Discover → Classify → Enforce → Prove' as const;

/**
 * Secondary / funnel / design-preview copy — not the live `/` H1 chrome.
 * Same words as the live claim for SEO / legacy imports.
 */
export const HERO_EN_KICKER = 'AI Compliance Operations OS for Europe' as const;

export const SCAN_FUNNEL_MESSAGE =
  'In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.' as const;

export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSync erkennt, bewertet, steuert und dokumentiert Compliance kontinuierlich.' as const;

/** One value line under the H1 — mock lock. Competing motto/EU lines stay demoted. */
export const HERO_SUBLINE =
  'Runtime governance for regulated AI systems. Continuous evidence. EU-native by design.' as const;

/**
 * Monetization urgency — kept for secondary surfaces; not in the hero fold.
 * Does not replace HERO_HEADLINE or HERO_SUBLINE.
 */
export const HERO_VALUE_SUBLINE = 'Vermeide EU AI Act-Bußgelder.' as const;

/** Honest scan badge on the primary cream CTA (not a fake speed claim). */
export const HERO_SCAN_BADGE = 'Kostenlos' as const;

/** Framework social proof — below the fold / secondary, not hero chrome. */
export const HERO_SOCIAL_PROOF =
  'Gebaut für regulierte KI in der EU.' as const;

export const HERO_SOCIAL_FRAMEWORKS = ['DSGVO', 'EU AI Act', 'C2PA'] as const;

export const HERO_OUTCOMES: readonly string[] = [
  'AI Inventory ohne Excel und Schattennutzung',
  'Policies durchsetzen statt nur dokumentieren',
  'Audit-Evidence laufend erzeugen, nicht kurz vor der Prüfung sammeln',
] as const;

export const HERO_EU_LINE =
  'Gebaut für EU AI Act, DSGVO und europäische Nachweispflichten.' as const;

/** Live `/` hero CTAs — Free Audit + Live Dashboard (cream/gold, not cyan). */
export const HERO_SCAN_CTA_LABEL = 'Free Audit starten' as const;
export const HERO_SCAN_CTA_LONG = 'Free Audit starten' as const;
export const HERO_DASHBOARD_CTA_LABEL = 'Live Dashboard ansehen' as const;

export const HERO_SCAN_PROMISE_LINE =
  'Finde deine Compliance-Risiken — kostenlos analysieren' as const;

export const HERO_SCAN_CTA_PROMISE =
  'URL eingeben — Top-3-Risiken und Evidence-Preview. Danach Activation, nicht nur der Score.' as const;

if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der ' +
      'HERO_HEADLINE vor — FE-001 würde fehlschlagen.',
  );
}

if (HERO_HEADLINE_LINES.length > 2) {
  throw new Error('hero-content.ts: H1 must stay ≤ 2 lines (Europe alone on line 2).');
}

if (HERO_HEADLINE_LINES[1] !== 'Europe') {
  throw new Error('hero-content.ts: line 2 must be gold Europe alone.');
}
