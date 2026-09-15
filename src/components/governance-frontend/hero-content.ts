/**
 * Single Source of Truth für Hero-Copy der Startseite.
 *
 * Structure/copy lock: Dominik bundler `class=hero reveal` (HTML drop-in) —
 * Dark/Gold/Cream chrome only. Never import Complianty light / cyan tokens,
 * `.hero-kpis` fake SLA numbers, or Demo dashboard chrome from that HTML.
 *
 * `MainLanding` renders H1 exclusively from `HERO_HEADLINE`. E2E / FE-001
 * read the same source — change here, not in the page.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → Gold-Akzent (em Europe). */
  accent?: boolean;
};

/**
 * Claim words (locked): AI Compliance Operations OS for Europe.
 *
 * Break (bundler hero): AI Compliance / Operations OS for / em Europe.
 */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Compliance' }],
  [{ text: 'Operations OS for' }],
  [{ text: 'Europe', accent: true }],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(''),
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'AI Compliance';

/**
 * Bundler kicker — three mono cells, not one long dash string.
 * Render as: 01 · AI GOVERNANCE · RUNNING IN REAL TIME · EU-CENTRAL
 */
export const HERO_KICKER = {
  index: '01',
  claim: 'AI GOVERNANCE · RUNNING IN REAL TIME',
  region: 'EU-CENTRAL',
} as const;

/** @deprecated Prefer HERO_KICKER parts — kept for secondary surfaces. */
export const HERO_EYEBROW =
  `${HERO_KICKER.index} — ${HERO_KICKER.claim} — ${HERO_KICKER.region}` as const;

/** Operating loop under the H1 (bundler lock). */
export const HERO_OPERATING_LOOP = 'DISCOVER → CLASSIFY → ENFORCE → PROVE' as const;

/**
 * Secondary / funnel / design-preview copy — not the live `/` H1 chrome.
 * Same words as the live claim for SEO / legacy imports.
 */
export const HERO_EN_KICKER = 'AI Compliance Operations OS for Europe' as const;

export const SCAN_FUNNEL_MESSAGE =
  'In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.' as const;

export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSync erkennt, bewertet, steuert und dokumentiert Compliance kontinuierlich.' as const;

/** Lede under the loop — bundler lock. */
export const HERO_SUBLINE =
  'Runtime governance for regulated AI systems. Continuous evidence. EU-native by design.' as const;

/**
 * Monetization urgency — secondary surfaces only; not hero chrome.
 * Does not replace HERO_HEADLINE or HERO_SUBLINE.
 */
export const HERO_VALUE_SUBLINE = 'Vermeide EU AI Act-Bußgelder.' as const;

/** Honest scan badge on the primary cream CTA (not a fake speed claim). */
export const HERO_SCAN_BADGE = 'Kostenlos' as const;

/** Framework social proof — secondary; hero uses HERO_PROOF_CHIPS. */
export const HERO_SOCIAL_PROOF =
  'Gebaut für regulierte KI in der EU.' as const;

export const HERO_SOCIAL_FRAMEWORKS = ['DSGVO', 'EU AI Act', 'C2PA'] as const;

export const HERO_OUTCOMES: readonly string[] = [
  'AI Inventory ohne Excel und Schattennutzung',
  'Policies durchsetzen statt nur dokumentieren',
  'Audit-Evidence laufend erzeugen, nicht kurz vor der Prüfung sammeln',
] as const;

/** EU line under the lede — bundler lock. */
export const HERO_EU_LINE =
  'Gebaut für EU AI Act, DSGVO und europäische Nachweispflichten.' as const;

/**
 * Proof chips under the CTA row — labels only, never fake counts / SLA %.
 * Bundler lock (Dark/Gold chrome).
 */
export const HERO_PROOF_CHIPS = [
  'EVIDENCE-CHAIN',
  'AI-ACT-KLASSIFIKATION',
  'PROVENANCE',
  'C2PA',
] as const;

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

if (HERO_HEADLINE_LINES[HERO_HEADLINE_LINES.length - 1] !== 'Europe') {
  throw new Error('hero-content.ts: last H1 line must be gold Europe alone.');
}

const lockedClaim = HERO_HEADLINE_LINES.join(' ').replace(/\s+/g, ' ').trim();
if (lockedClaim !== 'AI Compliance Operations OS for Europe') {
  throw new Error(
    `hero-content.ts: locked claim drift — got "${lockedClaim}"`,
  );
}
