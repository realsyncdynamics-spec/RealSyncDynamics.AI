/**
 * Single Source of Truth für die Hero-Headline der Startseite.
 *
 * Dominik Dark/Gold Referenz (Sept 2026): „AI Governance, Running in Real Time“.
 * Live `/` und FE-001 lesen dieselbe Quelle — Änderungen nur hier.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → Gold-Akzent (Playfair italic in der Referenz). */
  accent?: boolean;
};

/**
 * Governance OS Hero — Dominik-Referenz.
 *
 * Claim direction: Govern AI. Prove Everything. Operate with Confidence.
 *
 * ## Contract
 *
 * `MainLanding` renders H1 exclusively from `HERO_HEADLINE`. E2E / FE-001
 * read the same source — change here, not in the page.
 */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Governance,' }],
  [{ text: 'Running in Real', accent: true }],
  [{ text: 'Time', accent: true }],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(''),
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'AI Governance';

/** Motto under the H1 — Detect.Govern.Prove.Automate */
export const HERO_OPERATING_LOOP = 'Detect · Govern · Prove · Automate' as const;

export const HERO_KICKER = {
  index: '01',
  claim: 'AI GOVERNANCE · RUNNING IN REAL TIME',
  region: 'EU-CENTRAL',
} as const;

export const HERO_EYEBROW =
  `${HERO_KICKER.index} — ${HERO_KICKER.claim} — ${HERO_KICKER.region}` as const;

/** Secondary / funnel / design-preview copy — not alternate live H1. */
export const HERO_EN_KICKER = 'AI Governance, Running in Real Time' as const;

export const SCAN_FUNNEL_MESSAGE =
  'In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.' as const;

export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSync erkennt, bewertet, steuert und dokumentiert Compliance kontinuierlich.' as const;

export const HERO_SUBLINE =
  'Govern AI. Prove Everything. Operate with Confidence.' as const;

export const HERO_VALUE_SUBLINE = 'Vermeide EU AI Act-Bußgelder.' as const;

export const HERO_SCAN_BADGE = 'Kostenlos' as const;

export const HERO_SOCIAL_PROOF = 'Gebaut für regulierte KI in der EU.' as const;

export const HERO_SOCIAL_FRAMEWORKS = ['DSGVO', 'EU AI Act', 'C2PA'] as const;

export const HERO_OUTCOMES: readonly string[] = [
  'AI Inventory ohne Excel und Schattennutzung',
  'Policies durchsetzen statt nur dokumentieren',
  'Audit-Evidence laufend erzeugen, nicht kurz vor der Prüfung sammeln',
] as const;

export const HERO_EU_LINE =
  'Gebaut für EU AI Act, DSGVO und europäische Nachweispflichten.' as const;

export const HERO_PROOF_CHIPS = [
  'EVIDENCE-CHAIN',
  'AI-ACT-KLASSIFIKATION',
  'PROVENANCE',
  'C2PA',
] as const;

/** Live `/` Dominik CTA copy (also header). */
export const HERO_SCAN_CTA_LABEL = 'Kostenlosen Governance Scan starten' as const;
export const HERO_SCAN_CTA_LONG = 'Kostenlosen Governance Scan starten' as const;
export const HERO_DASHBOARD_CTA_LABEL = 'Explore the Governance OS' as const;

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
