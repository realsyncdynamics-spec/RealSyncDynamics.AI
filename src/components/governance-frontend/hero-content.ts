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
 * Substring der sichtbaren H1 auf `/` („Ihre KI kann handeln. Jetzt braucht
 * sie Governance.", `src/i18n/handoff.ts`, Governance-OS-Positionierung).
 * Genutzt von tests/e2e/public-routes.spec.ts (FE-001).
 */
export const GOVERNANCE_AI_HERO_TEST_SUBSTRING = 'kann handeln' as const;

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
/** Anker-CTA auf den Beispiel-Audit-Trail (`#audit-trail`, Titan-Referenzhero). */
export const HERO_AUDIT_TRAIL_CTA_LABEL = 'Beispiel-Audit-Trail ansehen' as const;

export const HERO_SCAN_PROMISE_LINE =
  'Governance-Scan starten — Risiken und Evidence-Preview' as const;

export const HERO_SCAN_CTA_PROMISE =
  'URL oder Kontext eingeben — Risiken, Policy-Hinweise und Evidence-Preview. Danach Activation, nicht nur der Score.' as const;

/*
 * Startseite `/` — Governance-OS-Positionierung (Enterprise Control Plane).
 *
 * Kategorie: AI Governance OS — nicht „EU-AI-Act-Software". Compliance ist ein
 * Ergebnis guter Governance, Governance ist das Produkt.
 *
 * Claim-Regel: Jede Aussage hier ist durch Code belegt (Belege im PR #1612).
 * Alles, was Zahlen oder Statuswerte zeigt, ist als Beispiel gekennzeichnet
 * (`DEMO_LABEL`) — es gibt keine Live-Kundendaten auf der Startseite.
 */

/** Kennzeichnung jeder Beispielfläche (Pipeline, Control Room, System-Story). */
export const DEMO_LABEL = 'Beispielumgebung · Demo-Daten' as const;

export type HomepageStageStatus = 'live' | 'preview';

/** Geführte Produktdemonstration 01–07 (`GovernanceSystemStory`). */
export const SYSTEM_STORY_CHAPTERS: readonly {
  id: string;
  step: string;
  title: string;
  body: string;
  status: HomepageStageStatus;
}[] = [
  {
    id: 'landscape',
    step: 'AI LANDSCAPE',
    title: 'KI wächst schneller als die Kontrolle darüber.',
    body: 'Mehrere Anbieter, eigene Automationen, erste Agenten — und niemand kann zentral sagen, welche Regeln gelten.',
    status: 'live',
  },
  {
    id: 'discover',
    step: 'DISCOVER',
    title: 'Jedes KI-System bekommt einen Namen und einen Owner.',
    body: 'Ein Inventar über Systeme, Anbieter, Anwendungen und Verantwortliche.',
    status: 'live',
  },
  {
    id: 'assess',
    step: 'ASSESS',
    title: 'Risiko wird bewertet, bevor es eskaliert.',
    body: 'Klassifizierung nach definierten Kriterien — Handlungsbedarf wird sichtbar.',
    status: 'live',
  },
  {
    id: 'govern',
    step: 'GOVERN',
    title: 'Policies legen fest, wer was darf.',
    body: 'Regeln, Rollen und Freigaben gelten für jedes System — nicht je Tool.',
    status: 'live',
  },
  {
    id: 'execute',
    step: 'EXECUTE',
    title: 'Ausgeführt wird erst nach der Entscheidung.',
    body: 'Identität, Tenant, Policy, Risiko und bei Bedarf Freigabe stehen vor jeder Aktion.',
    status: 'preview',
  },
  {
    id: 'verify',
    step: 'VERIFY',
    title: 'Das Ergebnis wird gegen die Entscheidung geprüft.',
    body: 'Die Integrität der Nachweiskette lässt sich jederzeit nachrechnen.',
    status: 'live',
  },
  {
    id: 'prove',
    step: 'PROVE',
    title: 'Jede Entscheidung bleibt belegbar.',
    body: 'Entscheidungen und Freigaben landen SHA-256-verkettet in der Evidence Chain.',
    status: 'live',
  },
] as const;

/** Beispielsysteme der System-Story — generisch, keine Kundendaten. */
export const SYSTEM_STORY_ROWS: readonly {
  system: string;
  owner: string;
  risk: 'niedrig' | 'mittel' | 'hoch';
  policy: string;
  execution: string;
}[] = [
  { system: 'Chat-Assistent (Cloud)', owner: 'IT', risk: 'mittel', policy: 'Keine Kundendaten', execution: 'erlaubt' },
  { system: 'Support-Bot', owner: 'Service', risk: 'mittel', policy: 'Transparenzhinweis', execution: 'erlaubt' },
  { system: 'Rechnungs-Agent', owner: 'Finance', risk: 'hoch', policy: 'Freigabe ab Schwelle', execution: 'Freigabe' },
  { system: 'Code-Assistent', owner: 'Engineering', risk: 'niedrig', policy: 'Repo-Scope', execution: 'erlaubt' },
  { system: 'Eigenes Modell (EU-lokal)', owner: 'Data', risk: 'mittel', policy: 'Nur EU-Region', execution: 'erlaubt' },
] as const;

export type PipelineStatusTone = 'ok' | 'warn' | 'block' | 'idle';

/** Signature Governance Pipeline — Szenarien mit Beispiel-Statuswerten. */
export const PIPELINE_STAGES = [
  'Request',
  'Identity',
  'Tenant',
  'Policy',
  'Risk',
  'Approval',
  'Execution',
  'Verification',
  'Evidence',
] as const;

export type PipelineScenarioId = 'approval' | 'violation' | 'routine';

export const PIPELINE_SCENARIOS: Record<
  PipelineScenarioId,
  {
    label: string;
    actor: string;
    action: string;
    /** Statuswert und Ton je Stufe, gleiche Reihenfolge wie PIPELINE_STAGES. */
    results: readonly (readonly [string, PipelineStatusTone])[];
  }
> = {
  approval: {
    label: 'Freigabe erforderlich',
    actor: 'finance-agent',
    action: 'Zahlung an neuen Lieferanten auslösen',
    results: [
      ['RECEIVED', 'ok'],
      ['VERIFIED', 'ok'],
      ['RESOLVED', 'ok'],
      ['REQUIRE APPROVAL', 'warn'],
      ['HIGH', 'warn'],
      ['APPROVED', 'ok'],
      ['RELEASED', 'ok'],
      ['SUCCESS', 'ok'],
      ['RECORDED', 'ok'],
    ],
  },
  violation: {
    label: 'Policy-Verstoß',
    actor: 'support-agent',
    action: 'Kundendaten an externes Modell senden',
    results: [
      ['RECEIVED', 'ok'],
      ['VERIFIED', 'ok'],
      ['RESOLVED', 'ok'],
      ['BLOCKED', 'block'],
      ['—', 'idle'],
      ['—', 'idle'],
      ['NOT EXECUTED', 'block'],
      ['—', 'idle'],
      ['RECORDED', 'ok'],
    ],
  },
  routine: {
    label: 'Routine-Aktion',
    actor: 'code-assistant',
    action: 'Pull-Request-Beschreibung erstellen',
    results: [
      ['RECEIVED', 'ok'],
      ['VERIFIED', 'ok'],
      ['RESOLVED', 'ok'],
      ['ALLOW', 'ok'],
      ['LOW', 'ok'],
      ['NOT REQUIRED', 'idle'],
      ['RELEASED', 'ok'],
      ['SUCCESS', 'ok'],
      ['RECORDED', 'ok'],
    ],
  },
};

/** Index der Freigabe-Stufe — dort hält das Szenario `approval` an. */
export const PIPELINE_APPROVAL_INDEX = PIPELINE_STAGES.indexOf('Approval');

/** Agent Governance: was ein Agent ausdrücklich nicht darf. */
export const AGENT_CANNOT = [
  'seine eigene Identität bestimmen',
  'seinen Tenant wählen',
  'Policies außer Kraft setzen',
  'eigene kritische Aktionen genehmigen',
] as const;

export const AGENT_LAYER = ['Identity', 'Tenant', 'Policy', 'Risk', 'Approval'] as const;

/**
 * Serverseitig angebundene Provider (Adapter in `supabase/functions/_shared`).
 * Grok/xAI, Mistral und MCP-Tool-Governance sind nicht angebunden und stehen
 * deshalb nicht hier.
 */
export const HOMEPAGE_PROVIDERS = [
  { name: 'OpenAI', note: 'Cloud' },
  { name: 'Anthropic · Claude', note: 'Cloud' },
  { name: 'Google · Gemini', note: 'Cloud · eingeschränkt' },
  { name: 'Eigene Modelle', note: 'Ollama · LM Studio · EU-lokal' },
] as const;

/** Control Room — ausschließlich Beispielwerte, sichtbar gekennzeichnet. */
export const CONTROL_ROOM_METRICS = [
  { label: 'Aktive KI-Systeme', value: '12' },
  { label: 'Policy-Entscheidungen · 7 Tage', value: '184' },
  { label: 'Offene Freigaben', value: '3' },
  { label: 'Blockierte Ausführungen', value: '2' },
  { label: 'Evidence-Einträge', value: '1.248' },
] as const;

/** Verdikte entsprechen dem Vokabular des Policy Decision Point. */
export const CONTROL_ROOM_DECISIONS: readonly {
  time: string;
  actor: string;
  action: string;
  verdict: 'allow' | 'warn' | 'block' | 'require_approval' | 'log_only';
}[] = [
  { time: '09:41:12', actor: 'finance-agent', action: 'payment.create', verdict: 'require_approval' },
  { time: '09:40:57', actor: 'support-agent', action: 'model.invoke · external', verdict: 'block' },
  { time: '09:40:31', actor: 'code-assistant', action: 'repo.pr.describe', verdict: 'allow' },
  { time: '09:39:48', actor: 'marketing-flow', action: 'content.publish', verdict: 'warn' },
  { time: '09:39:02', actor: 'chat-assistant', action: 'model.invoke · eu-local', verdict: 'log_only' },
] as const;

/** Wirtschaftlicher Nutzen — ohne ROI-Zahlen. */
export const HOMEPAGE_VALUE = [
  'Zentrale Kontrolle über alle KI-Systeme',
  'Weniger manuelle Freigaben per Chat und E-Mail',
  'Weniger Tool-Wildwuchs',
  'Klare Verantwortlichkeiten je System',
  'Agenten mit definierten Grenzen',
  'Wiederverwendbare Policies statt Einzelregeln',
  'Nachvollziehbarkeit ohne Audit-Feuerwehr',
  'Schnellere Freigabe neuer KI-Use-Cases',
] as const;

/** Executive-Sektion: eine Control Plane, drei Ebenen. */
export const CONTROL_PLANE_LAYERS = [
  { layer: 'EXECUTIVE', title: 'Sichtbarkeit, Verantwortung, Risiko', body: 'Welche KI läuft, wem sie gehört, wo das Risiko liegt.' },
  { layer: 'GOVERNANCE', title: 'Policies, Freigaben, Evidence', body: 'Regeln setzen, Ausnahmen freigeben, Entscheidungen belegen.' },
  { layer: 'ENGINEERING', title: 'Identität, Ausführung, Provider', body: 'Jeder Aufruf authentifiziert, entschieden und protokolliert.' },
] as const;

/** Vertrauen durch Architektur — jedes Prinzip durch Code belegt. */
export const HOMEPAGE_TRUST_PRINCIPLES = [
  {
    title: 'Server-autoritative Mandanten',
    body: 'Row-Level-Security trennt Tenants in der Datenbank; der Tenant wird serverseitig abgeleitet, nie vom Client übernommen.',
  },
  {
    title: 'Policy-basierte Ausführung',
    body: 'Der Policy Decision Point entscheidet: erlauben, warnen, blockieren, Freigabe verlangen — beobachtend oder durchsetzend.',
  },
  {
    title: 'Human Approval',
    body: 'Freigaben nur durch berechtigte Rollen; jede Entscheidung erzeugt einen Nachweis.',
  },
  {
    title: 'Provider-Trennung',
    body: 'Die Entscheidung liegt außerhalb der Modell-Adapter — kein Provider bewertet sich selbst.',
  },
  {
    title: 'Prüfbare Evidence',
    body: 'SHA-256-verkettete Einträge, gegen nachträgliche Änderung per Trigger gesperrt, mit Integritätsprüfung.',
  },
] as const;

/**
 * Governance-Check auf `/` — reine Selbsteinschätzung im Browser. Kein
 * Request, keine Speicherung: Das Ergebnis zählt nur die eigenen Antworten.
 * `yes` bedeutet jeweils „die Kontrolle ist vorhanden".
 */
export const GOVERNANCE_CHECK_QUESTIONS: readonly {
  id: string;
  stage: 'DISCOVER' | 'ASSESS' | 'GOVERN' | 'PROVE';
  question: string;
  gap: string;
}[] = [
  {
    id: 'providers',
    stage: 'DISCOVER',
    question: 'Wissen Sie, welche KI-Anbieter in Ihrem Unternehmen genutzt werden?',
    gap: 'Kein zentrales Bild der eingesetzten KI-Anbieter.',
  },
  {
    id: 'autonomous',
    stage: 'DISCOVER',
    question: 'Wissen Sie, welche Systeme oder Agenten selbstständig Aktionen ausführen können?',
    gap: 'Unklar, welche Systeme ohne Menschen handeln.',
  },
  {
    id: 'customer-data',
    stage: 'ASSESS',
    question: 'Ist geregelt, ob Kundendaten in KI-Systeme gelangen dürfen?',
    gap: 'Keine Regel für Kundendaten in KI-Systemen.',
  },
  {
    id: 'owners',
    stage: 'GOVERN',
    question: 'Gibt es für jedes KI-System eine verantwortliche Person?',
    gap: 'Verantwortlichkeiten sind nicht zugeordnet.',
  },
  {
    id: 'policies',
    stage: 'GOVERN',
    question: 'Gibt es zentrale Regeln, die für alle KI-Anbieter gelten?',
    gap: 'Regeln gelten je Tool statt zentral.',
  },
  {
    id: 'data-egress',
    stage: 'GOVERN',
    question: 'Ist kontrolliert, welche Daten an welchen Provider gehen dürfen?',
    gap: 'Datenabfluss an Provider ist nicht gesteuert.',
  },
  {
    id: 'approval',
    stage: 'GOVERN',
    question: 'Brauchen kritische KI-Aktionen eine menschliche Freigabe?',
    gap: 'Kritische Aktionen laufen ohne Freigabe.',
  },
  {
    id: 'logging',
    stage: 'PROVE',
    question: 'Werden KI-Entscheidungen und Ausführungen nachvollziehbar protokolliert?',
    gap: 'Entscheidungen und Ausführungen sind nicht belegbar.',
  },
] as const;

if (!HERO_HEADLINE_LINES.some((line) => line.includes(HERO_HEADLINE_TEST_SUBSTRING))) {
  throw new Error(
    'hero-content.ts: HERO_HEADLINE_TEST_SUBSTRING kommt in keiner Zeile der ' +
      'HERO_HEADLINE vor — FE-001 würde fehlschlagen.',
  );
}
