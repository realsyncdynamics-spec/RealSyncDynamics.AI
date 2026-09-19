/**
 * SSOT Hero-Copy — Replit visual reference (Dark/Gold Europe-network).
 *
 * H1: „AI Compliance Operations OS für Europa.“
 * Serif/gold emphasis exclusively on „Operations OS“.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → amber/gold serif emphasis (Operations OS only). */
  accent?: boolean;
};

export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Compliance' }],
  [{ text: 'Operations OS', accent: true }],
  [{ text: 'für Europa.' }],
];

export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(''),
);

export const HERO_HEADLINE_TEST_SUBSTRING = 'AI Compliance';

export const HERO_KICKER = {
  index: '01',
  claim: 'GOVERNANCE-INFRASTRUKTUR FÜR EUROPA',
  region: 'EU',
} as const;

export const HERO_EYEBROW = `→ ${HERO_KICKER.claim}` as const;

/** Operating loop under the H1 — German Discover chain (Replit). */
export const HERO_OPERATING_LOOP =
  'Entdecken. Klassifizieren. Durchsetzen. Beweisen.' as const;

export const HERO_EN_KICKER = 'AI Compliance Operations OS für Europa.' as const;

export const SCAN_FUNNEL_MESSAGE =
  'In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.' as const;

export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSyncDynamics verbindet Ihre Systeme, Policies und Nachweise in einer lebenden Operations-Schicht.' as const;

export const HERO_SUBLINE =
  'Die laufende Governance-Schicht für regulierte KI-Systeme — EU-native by design.' as const;

export const HERO_VALUE_SUBLINE = 'Vermeide EU AI Act-Bußgelder.' as const;

export const HERO_SCAN_BADGE = 'Kostenlos' as const;

export const HERO_SOCIAL_PROOF = 'Gebaut für regulierte KI in der EU.' as const;

export const HERO_SOCIAL_FRAMEWORKS = ['DSGVO', 'EU AI Act', 'ISO 42001'] as const;

export const HERO_OUTCOMES: readonly string[] = [
  'AI Inventory ohne Excel und Schattennutzung',
  'Policies durchsetzen statt nur dokumentieren',
  'Audit-Evidence laufend erzeugen, nicht kurz vor der Prüfung sammeln',
] as const;

export const HERO_EU_LINE =
  'Gebaut für EU AI Act, DSGVO und europäische Nachweispflichten.' as const;

/** Trust row — Replit SSOT (labels only). */
export const HERO_PROOF_CHIPS = [
  'EU AI ACT READY',
  'ISO 42001 ALIGNED',
  'DSGVO FIRST',
  'AUDIT TRAIL NATIVE',
] as const;

/** Header primary CTA. */
export const HERO_SCAN_CTA_LABEL = 'Free Audit starten' as const;
/** Hero primary CTA (long form). */
export const HERO_SCAN_CTA_LONG = 'Kostenlosen Audit starten' as const;
/** Hero secondary CTA. */
export const HERO_DASHBOARD_CTA_LABEL = 'Live Evidence ansehen' as const;

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
