/**
 * SSOT Hero-Copy — Titan-Entwurf, Europa-Relief.
 *
 * H1 zweizeilig: „AI Compliance“ / „Operations OS for Europe“.
 * Der Akzent liegt ausschliesslich auf „for Europe“ — im Entwurf traegt der
 * Europa-Teil die Farbe, nicht das Produktwort.
 *
 * Welche Farbe das ist, steht hier bewusst nicht: Sie kommt aus
 * `components/landing/landing-theme.ts` (Design-Lock v2 — True Black,
 * Cyan als Handlungsakzent, Gold nur fuer VIP). Diese Datei traegt die
 * Copy, nicht die Palette.
 */

export type HeroHeadlineSegment = {
  text: string;
  /** true → Akzentfarbe aus `landing-theme` (nur „for Europe“). */
  accent?: boolean;
};

export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'AI Compliance' }],
  [{ text: 'Operations OS' }, { text: 'for Europe', accent: true }],
];

/**
 * Infrastrukturzeilen unter dem Operating Loop.
 *
 * Jede Angabe ist im Repo belegt — Supabase Frankfurt, Evidence Vault,
 * Hash-Chain, Ollama (eu_local), Multi-Tenant RLS, n8n und Stripe sind
 * vorhandene Bestandteile, keine Absichtserklaerungen. Wer hier etwas
 * ergaenzt, muss es vorher belegen koennen: Die Seite verkauft
 * Nachweisbarkeit.
 */
export const HERO_INFRA_LINES: readonly (readonly string[])[] = [
  ['EU-Hosted Runtime', 'Supabase Frankfurt', 'Evidence Vault'],
  ['Hash-Chain', 'Ollama local', 'Multi-Tenant RLS', 'n8n', 'Stripe'],
];

/**
 * Beschriftung des Gratis-Plan-Ankers in der Chip-Reihe.
 *
 * Bewusst kuerzer als `HERO_SCAN_CTA_LABEL`: Im Entwurf traegt die
 * Navigation „Free Audit starten“, der Chip in der Planreihe nur
 * „Free Audit“ — er steht dort neben Plannamen, nicht neben CTAs.
 */
export const HERO_PLAN_ANCHOR_FREE = 'Free Audit' as const;

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

/** Operating Loop unter der H1 — Pfeilkette des Titan-Entwurfs. */
export const HERO_OPERATING_LOOP =
  'DISCOVER → CLASSIFY → ENFORCE → PROVE' as const;

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
