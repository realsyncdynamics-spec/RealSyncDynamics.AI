/**
 * Single Source of Truth für Hero + Scan-Funnel-Copy der Startseite.
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
 * Dominik core message (DE) — two lines, no orphan words.
 * Control/Policy/Audit/Evidence layer — not a chatbot, not a cookie scanner.
 */
export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'Erkenne, steuere und belege' }],
  [{ text: 'jede KI-Nutzung in deinem Unternehmen.', accent: true }],
];

/** Reine Textzeilen der H1 — für Tests und Accessible-Name-Abgleich. */
export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(''),
);

/** Substring für den FE-001-Check. Muss vollständig innerhalb einer Zeile liegen. */
export const HERO_HEADLINE_TEST_SUBSTRING = 'KI-Nutzung';

/** English kicker above the DE H1 when needed. */
export const HERO_EN_KICKER = 'Govern every AI system in one control layer.' as const;

/** Motto under the H1 — continuous compliance loop */
export const HERO_OPERATING_LOOP =
  'Detect → Analyze → Govern → Remediate → Evidence → Monitor' as const;

/**
 * Locked page slogan (Complianty-inspired timing, not a cookie scanner).
 * Scan → structure → continuous control — AI Governance OS ladder.
 */
export const SCAN_FUNNEL_MESSAGE =
  'In Minuten scannen. In Stunden strukturieren. Dauerhaft kontrollieren.' as const;

/** Continuous-compliance narrative — not “choose a check / many tools”. */
export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSync erkennt, bewertet, steuert und dokumentiert Compliance kontinuierlich.' as const;

/** Hero subline — layer over models/workflows, not a chatbot. */
export const HERO_SUBLINE =
  'Eine Governance- und Evidence-Schicht über ChatGPT, Claude, Agenten und internen AI-Workflows.' as const;

/** Outcomes — not feature chips. */
export const HERO_OUTCOMES: readonly string[] = [
  'AI Inventory ohne Excel und Schattennutzung',
  'Policies durchsetzen statt nur dokumentieren',
  'Audit-Evidence laufend erzeugen, nicht kurz vor der Prüfung sammeln',
] as const;

export const HERO_EU_LINE =
  'Gebaut für EU AI Act, DSGVO und europäische Nachweispflichten.' as const;

/**
 * Hero form: promise line + short button.
 * Scan is acquisition only — product continues in Activation / workspace.
 */
export const HERO_SCAN_PROMISE_LINE =
  'Finde deine Compliance-Risiken — kostenlos analysieren' as const;

export const HERO_SCAN_CTA_LABEL = 'Kostenlos starten' as const;

/** Longer header/footer CTA — never Demo/testen. */
export const HERO_SCAN_CTA_LONG = 'Governance kostenlos starten' as const;

/** Result promise under the URL form (DE, cream). */
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
