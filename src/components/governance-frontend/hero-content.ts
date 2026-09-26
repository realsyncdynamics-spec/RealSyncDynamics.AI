/**
 * SSOT Hero-Copy — Dominik Go Homepage 2026-09-24 (Positionierungsbrief).
 * Control-/Evidence-Layer für KI (nicht Website-Builder / CodeRabbit).
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → Goldakzent. */
  accent?: boolean;
};

export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'Machen Sie KI-Nutzung' }],
  [{ text: 'kontrollierbar, nachweisbar' }],
  [{ text: 'und' }, { text: 'auditbereit.', accent: true }],
];

/** Brand Direction — production landing kicker. */
export const GOVERNANCE_AI_HERO_KICKER = 'EU CONTROL & EVIDENCE LAYER FOR AI' as const;

export const GOVERNANCE_AI_HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = HERO_HEADLINE;

/**
 * Substring der sichtbaren H1 auf `/` (Handoff v2: „AI Compliance / Operations OS for Europe").
 * Genutzt von tests/e2e/public-routes.spec.ts (FE-001).
 */
export const GOVERNANCE_AI_HERO_TEST_SUBSTRING = 'Operations OS' as const;

export const GOVERNANCE_AI_HERO_SUBLINE =
  'RealSyncDynamics.AI erkennt KI- und Compliance-Risiken, setzt Richtlinien durch und erzeugt kontinuierliche Evidenz für EU AI Act und DSGVO.' as const;

export const GOVERNANCE_AI_HERO_MICRO =
  'SCAN → BUILD → AUTOMATE → GOVERN' as const;

export const BRAND_VALUE_PROPOSITION =
  'RealSyncDynamics.AI ist die europäische Control- und Evidence-Layer für KI: Schatten-KI sichtbar machen, Verantwortlichkeiten klären und Audit-Evidenz laufend erzeugen — für EU AI Act und DSGVO.' as const;

export const BRAND_PRODUCT_DESCRIPTION =
  'RealSyncDynamics.AI erkennt KI- und Compliance-Risiken, setzt Richtlinien durch und erzeugt kontinuierliche Evidenz für EU AI Act und DSGVO. Scan Reality, Build Controls, Automate Evidence, Govern Continuously.' as const;

/**
 * Infrastrukturzeilen unter dem Operating Loop (belegte Bestandteile).
 */
export const HERO_INFRA_LINES: readonly (readonly string[])[] = [
  ['EU-Hosting', 'DSGVO', 'EU AI Act'],
  ['Audit Logs', 'Governance-by-Design', 'Evidence Vault'],
];

export const HERO_PLAN_ANCHOR_FREE = 'Governance-Scan' as const;

export const HERO_HEADLINE_LINES: readonly string[] = HERO_HEADLINE.map((segments) =>
  segments.map((s) => s.text).join(' '),
);

export const HERO_HEADLINE_TEST_SUBSTRING = 'kontrollierbar';

export const HERO_KICKER = {
  index: '01',
  claim: 'CONTROL & EVIDENCE FÜR KI IN EUROPA',
  region: 'EU',
} as const;

export const HERO_EYEBROW = `→ ${HERO_KICKER.claim}` as const;

export const HERO_OPERATING_LOOP = 'SCAN → BUILD → AUTOMATE → GOVERN' as const;

export const HERO_EN_KICKER = 'Control and Evidence Layer for AI in Europe.' as const;

export const SCAN_FUNNEL_MESSAGE =
  'Scannen. Kontrollen bauen. Evidenz automatisieren. Dauerhaft steuern.' as const;

export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSyncDynamics verbindet Signale, Risiken, Policies und Audit-Evidence in einer laufenden Governance-Schicht.' as const;

export const HERO_SUBLINE =
  'RealSyncDynamics.AI erkennt KI- und Compliance-Risiken, setzt Richtlinien durch und erzeugt kontinuierliche Evidenz für EU AI Act und DSGVO.' as const;

export const HERO_VALUE_SUBLINE = 'Schatten-KI sichtbar. Evidenz auditbereit.' as const;

export const HERO_SCAN_BADGE = 'Kostenlos' as const;

export const HERO_SOCIAL_PROOF = 'Gebaut für regulierte KI in der EU.' as const;

export const HERO_SOCIAL_FRAMEWORKS = ['DSGVO', 'EU AI Act', 'ISO 42001'] as const;

export const HERO_OUTCOMES: readonly string[] = [
  'Schatten-KI und fehlendes Inventar schließen',
  'Verantwortlichkeiten und Freigaben klar zuweisen',
  'Audit-Evidence laufend erzeugen statt manuell sammeln',
] as const;

export const HERO_EU_LINE =
  'EU-Hosting, DSGVO, EU AI Act, Audit Logs, Governance-by-Design.' as const;

export const HERO_PROOF_CHIPS = [
  'EU AI ACT READY',
  'DSGVO FIRST',
  'AUDIT TRAIL NATIVE',
  'GOVERNANCE BY DESIGN',
] as const;

/** Header + final CTA primary. */
export const HERO_SCAN_CTA_LABEL = 'Governance-Scan starten' as const;
export const HERO_SCAN_CTA_LONG = 'Governance-Scan starten' as const;
/** Hero secondary CTA (Handoff v2, Ziel `/app/dashboard`). */
export const HERO_DASHBOARD_CTA_LABEL = 'Live Dashboard ansehen' as const;
/** Copy and public destinations from the approved Europe screenshot (2026-09-25). */
export const EUROPE_REFERENCE_HERO = {
  description: [
    'Runtime governance for regulated AI systems.',
    'Continuous evidence. EU-native by design.',
  ],
  navigation: [
    { label: { de: 'Produkt', en: 'Product' }, to: '#modules' },
    { label: { de: 'Evidence', en: 'Evidence' }, to: '/evidence' },
    { label: { de: 'Preise', en: 'Pricing' }, to: '/pricing' },
    { label: { de: 'Login', en: 'Login' }, to: '/login' },
  ],
} as const;
/** Anker-CTA auf den Beispiel-Audit-Trail (`#audit-trail`, Titan-Referenzhero). */
export const HERO_AUDIT_TRAIL_CTA_LABEL = 'Beispiel-Audit-Trail ansehen' as const;

export const HERO_SCAN_PROMISE_LINE =
  'Governance-Scan starten — Risiken und Evidence-Preview' as const;

export const HERO_SCAN_CTA_PROMISE =
  'URL oder Kontext eingeben — Risiken, Policy-Hinweise und Evidence-Preview. Danach Activation, nicht nur der Score.' as const;

/** Homepage brief — Problem pains. */
export const HOMEPAGE_PROBLEM_PAINS = [
  {
    title: 'Schatten-KI',
    body: 'Tools und Modelle laufen außerhalb bekannter Inventare — ohne Freigabe und ohne Nachweis.',
  },
  {
    title: 'Fehlendes Inventar',
    body: 'Niemand hat die vollständige Liste der KI-Use-Cases, Websites und Datenflüsse.',
  },
  {
    title: 'Unklare Verantwortlichkeit',
    body: 'Rollen, Freigaben und Richtlinien sind verteilt oder fehlen — bis zur Prüfung.',
  },
  {
    title: 'Manuelle Evidenz',
    body: 'Nachweise werden kurz vor dem Audit zusammengesucht statt kontinuierlich erzeugt.',
  },
] as const;

/** Four modules — fixed order. */
export const HOMEPAGE_MODULES = [
  {
    id: 'scan',
    title: 'Scan Reality',
    body: 'KI-Use-Cases, Websites, Datenflüsse und Governance-Lücken sichtbar machen.',
  },
  {
    id: 'build',
    title: 'Build Controls',
    body: 'Risikoklassifikation, Verantwortlichkeiten, Richtlinien und Freigaben aufsetzen.',
  },
  {
    id: 'automate',
    title: 'Automate Evidence',
    body: 'Prüfungen, Monitoring und Evidenzsammlung automatisieren.',
  },
  {
    id: 'govern',
    title: 'Govern Continuously',
    body: 'AI Inventory, Policy Enforcement, Audit Trail und Telemetrie im laufenden Betrieb.',
  },
] as const;

export const HOMEPAGE_EVIDENCE_FLOW = [
  'Signal',
  'Risiko',
  'Policy',
  'Entscheidung',
  'Audit Evidence',
] as const;

export const HOMEPAGE_EU_TRUST = [
  'EU-Hosting',
  'DSGVO',
  'EU AI Act',
  'Audit Logs',
  'Governance-by-Design',
] as const;

export const HOMEPAGE_AUDIENCES = [
  {
    title: 'Compliance & Legal',
    body: 'Nachweispflichten erfüllen, ohne Excel-Chaos kurz vor dem Audit.',
  },
  {
    title: 'Security & Risk',
    body: 'Schatten-KI und Governance-Lücken früh erkennen und steuern.',
  },
  {
    title: 'Produkt & Engineering',
    body: 'Richtlinien und Freigaben in den Betrieb legen — nicht nur in Confluence.',
  },
] as const;

if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der ' +
      'HERO_HEADLINE vor — FE-001 würde fehlschlagen.',
  );
}
