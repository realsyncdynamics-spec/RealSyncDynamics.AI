/**
 * Single Source of Truth für Hero + Scan-Funnel-Copy der Startseite.
 *
 * Locked to Dominik Europe-OS mockup (graphite / gold / cream).
 * Änderungen ausschließlich hier — FE-001 und Scan-Funnel-Tests lesen mit.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → Gold-Akzent („Europe“). */
  accent?: boolean;
};

/**
 * Europe-OS H1 — two lines, large sans.
 * Line 1 white; line 2 leads with gold “Europe”.
 */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Compliance Operations OS' }],
  [
    { text: 'for ' },
    { text: 'Europe', accent: true },
  ],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(''),
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'Europe';

/** Optional EN kicker — unused in Europe-OS hero (kept for SEO/legacy imports). */
export const HERO_EN_KICKER = 'AI Compliance Operations OS for Europe' as const;

/** Operating loop under the H1 — small caps + arrows (mockup lock). */
export const HERO_OPERATING_LOOP =
  'DISCOVER → CLASSIFY → ENFORCE → PROVE' as const;

/**
 * Locked page slogan — timing ladder (scan → structure → continuous control).
 * Kept for spine / secondary surfaces; hero uses HERO_SUBLINE.
 */
export const SCAN_FUNNEL_MESSAGE =
  'In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.' as const;

/** Continuous-compliance narrative — not “choose a check / many tools”. */
export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSync erkennt, bewertet, steuert und dokumentiert Compliance kontinuierlich.' as const;

/** Hero subline — two sentences, mockup lock. */
export const HERO_SUBLINE =
  'Runtime governance for regulated AI systems. Continuous evidence. EU-native by design.' as const;

/** Outcomes — not shown in Europe-OS hero (spine / elsewhere). */
export const HERO_OUTCOMES: readonly string[] = [
  'AI Inventory ohne Excel und Schattennutzung',
  'Policies durchsetzen statt nur dokumentieren',
  'Audit-Evidence laufend erzeugen, nicht kurz vor der Prüfung sammeln',
] as const;

export const HERO_EU_LINE =
  'Gebaut für EU AI Act, DSGVO und europäische Nachweispflichten.' as const;

/**
 * Primary CTA — Free Audit starten (acquisition → /audit).
 * One primary only — never a second “Governance kostenlos starten” in the hero.
 */
export const HERO_SCAN_CTA_LABEL = 'Free Audit starten' as const;

/** Header / footer long form — same lock as hero primary. */
export const HERO_SCAN_CTA_LONG = 'Free Audit starten' as const;

/** Secondary hero CTA → /app (ComplianceStatusDashboard via AppGate). */
export const HERO_DASHBOARD_CTA_LABEL = 'Live Dashboard ansehen' as const;

/** Legacy promise lines — kept for AuditLanding / spine; not hero chrome. */
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
  throw new Error('hero-content.ts: H1 must stay ≤ 2 lines (no orphan words).');
}
