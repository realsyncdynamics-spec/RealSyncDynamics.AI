/**
 * SSOT Hero-Copy — Live-/ restored to Dominik Governance OS preview.
 * H1: AI Governance, Running in Real Time.
 */

export type HeroHeadlineSegment = {
  text: string;
  accent?: boolean;
};

export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Governance,' }],
  [{ text: 'Running in Real', accent: true }],
  [{ text: 'Time', accent: true }],
];

export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(''),
);

export const HERO_HEADLINE_TEST_SUBSTRING = 'AI Governance';

export const HERO_OPERATING_LOOP = 'Detect · Govern · Prove · Automate' as const;

export const HERO_KICKER = {
  index: '01',
  claim: 'AI GOVERNANCE · RUNNING IN REAL TIME',
  region: 'EU-CENTRAL',
} as const;

export const HERO_EYEBROW =
  `${HERO_KICKER.index} — ${HERO_KICKER.claim} — ${HERO_KICKER.region}` as const;

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

export const HERO_SCAN_CTA_LABEL = 'Kostenlosen Governance Scan starten' as const;
export const HERO_SCAN_CTA_LONG = 'Kostenlosen Governance Scan starten' as const;
export const HERO_DASHBOARD_CTA_LABEL = 'Explore the Governance OS' as const;

export const HERO_SCAN_PROMISE_LINE =
  'Finde deine Compliance-Risiken — kostenlos analysieren' as const;

export const HERO_SCAN_CTA_PROMISE =
  'URL eingeben — Top-3-Risiken und Evidence-Preview. Danach Activation, nicht nur der Score.' as const;

if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der HERO_HEADLINE vor.',
  );
}
