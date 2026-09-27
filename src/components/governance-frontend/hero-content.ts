/**
 * SSOT Hero-Copy — Dominik Go Homepage 2026-09-24 (Positionierungsbrief).
 * Control-/Evidence-Layer für KI (nicht Website-Builder / CodeRabbit).
 */
import { getImplementation, type ImplementationStatus } from '../../product/implementation-status';

export type HeroHeadlineSegment = {
  text: string;
  /** true → Goldakzent. */
  accent?: boolean;
};

export const HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = [
  [{ text: 'Europa braucht kein weiteres' }],
  [{ text: 'Frontier-Modell.' }],
  [{ text: 'Europa braucht Kontrolle über' }, { text: 'Frontier-KI.', accent: true }],
];

/** Brand Direction — production landing kicker. */
export const GOVERNANCE_AI_HERO_KICKER = 'THE GOVERNANCE OS FOR AUTONOMOUS AI' as const;

export const GOVERNANCE_AI_HERO_HEADLINE: readonly (readonly HeroHeadlineSegment[])[] = HERO_HEADLINE;

/**
 * Substring der sichtbaren H1 auf `/` („Die Kontrollschicht für KI im
 * Unternehmen.", gesetzt in `src/i18n/handoff.ts` → `heroA`–`heroC`;
 * Entscheidung E-F3 vom 2026-09-27).
 * Genutzt von tests/e2e/public-routes.spec.ts (FE-001); der Abgleich gegen die
 * wirklich gerenderte H1 liegt in test/landing/homepage-hero.test.tsx.
 *
 * Nicht zu verwechseln mit `HERO_HEADLINE_TEST_SUBSTRING`: das gehört zur
 * `HERO_HEADLINE` der Titan-/Design-Referenzen (`/design/titan`, `/design/ledger`,
 * `/design/tribunal`), die weiterhin „Frontier-KI" zeigen.
 */
export const GOVERNANCE_AI_HERO_TEST_SUBSTRING = 'Kontrollschicht' as const;

export const GOVERNANCE_AI_HERO_SUBLINE =
  'RealSyncDynamics.AI ist die Control Plane für Enterprise-KI. Wir bauen nicht die Intelligenz selbst. Wir bauen die Kontroll-, Autorisierungs- und Evidenzschicht zwischen Unternehmen und KI.' as const;

export const GOVERNANCE_AI_HERO_MICRO =
  'DISCOVER → ASSESS → GOVERN → EXECUTE → VERIFY → PROVE' as const;

export const BRAND_VALUE_PROPOSITION =
  'The Governance OS for Autonomous AI. Any model. Any agent. One control plane.' as const;

export const BRAND_PRODUCT_DESCRIPTION =
  'RealSyncDynamics.AI ist die Control Plane für Enterprise-KI: Identität, Tenant, Policy, Risiko, Freigabe, Ausführung, Verifikation und Evidence in einer Governance-Schicht über Modelle, Agenten und Provider.' as const;

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

export const HERO_HEADLINE_TEST_SUBSTRING = 'Frontier-KI';

export const HERO_KICKER = {
  index: '01',
  claim: 'THE GOVERNANCE OS FOR AUTONOMOUS AI',
  region: 'EU',
} as const;

export const HERO_EYEBROW = `→ ${HERO_KICKER.claim}` as const;

export const HERO_OPERATING_LOOP = 'DISCOVER → ASSESS → GOVERN → EXECUTE → VERIFY → PROVE' as const;

export const HERO_EN_KICKER = 'The Governance OS for Autonomous AI.' as const;

export const SCAN_FUNNEL_MESSAGE =
  'Entdecken. Bewerten. Steuern. Ausführen. Verifizieren. Mit Evidence beweisen.' as const;

export const CONTINUOUS_COMPLIANCE_NARRATIVE =
  'RealSyncDynamics verbindet Identität, Policies, Risiko, Freigaben, Ausführung, Verifikation und Evidence in einer laufenden Governance-Schicht.' as const;

export const HERO_SUBLINE =
  'RealSyncDynamics.AI ist die Control Plane für Enterprise-KI. Any model. Any agent. One control plane.' as const;

export const HERO_VALUE_SUBLINE = 'Kontrolle durchsetzen. Evidence jederzeit belegbar.' as const;

export const HERO_SCAN_BADGE = 'Kostenlos' as const;

export const HERO_SOCIAL_PROOF = 'Provider-neutral für Enterprise-KI in der EU.' as const;

export const HERO_SOCIAL_FRAMEWORKS = ['DSGVO', 'EU AI Act', 'ISO 42001'] as const;

export const HERO_OUTCOMES: readonly string[] = [
  'Sichtbar machen, welche KI tatsächlich läuft',
  'Policies, Freigaben und Ausführung zentral steuern',
  'Evidence kontinuierlich erzeugen und Compliance beweisen',
] as const;

export const HERO_EU_LINE =
  'EU-Hosting, DSGVO, EU AI Act, ISO 42001 und Audit-Evidence als Proof-Layer.' as const;

export const HERO_PROOF_CHIPS = [
  'EU AI ACT',
  'DSGVO',
  'ISO 42001',
  'EU HOSTING',
] as const;

/** Header + final CTA primary. */
export const HERO_SCAN_CTA_LABEL = 'Governance-Scan starten' as const;
export const HERO_SCAN_CTA_LONG = 'Governance-Scan starten' as const;

/**
 * Hero-CTAs auf `/` (WP1). Eigene Konstanten, weil `HERO_SCAN_CTA_LABEL` /
 * `HERO_SCAN_CTA_LONG` und `PUBLIC_CTA.label` den Header und die
 * Design-Referenzen tragen — dort bleibt „Governance-Scan starten".
 * Ziel des Primär-CTA ist `PUBLIC_CTA.to` (`/audit`), nicht hier verdrahtet.
 */
export const HERO_FREE_SCAN_CTA_LABEL = {
  de: 'Kostenlosen KI-/DSGVO-Scan starten',
  en: 'Start the free AI / GDPR scan',
} as const;

/** Sekundär-CTA im Hero — Ziel bleibt der bestehende `/contact-sales`-Link. */
export const HERO_ENTERPRISE_TALK_CTA_LABEL = {
  de: 'Enterprise sprechen',
  en: 'Talk to enterprise',
} as const;
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
 * Zielbild „AI Governance OS" in der Architektur-Sektion (WP1).
 *
 * Der Control Loop beschreibt die Kontrollschleife, nicht den Funktionsstand.
 * Genau eine Stufe trägt einen Statuswert: `LEARN / Governed Evolution` ist
 * `coming-soon` und wird über `STATUS_LABEL` beschriftet — die Landing setzt
 * keine eigenen Statuswörter.
 */
export const GOVERNANCE_OS_TARGET_KICKER = 'AI GOVERNANCE OS · ZIELBILD' as const;

export const GOVERNANCE_OS_TARGET_LEDE = {
  de: 'Das Zielbild ist ein geschlossener Kontrollkreis über jede KI-Aktion. Was heute schon läuft, steht im Einstiegspfad darunter — mit dem Stand, den die Implementierungs-Registry ausweist.',
  en: 'The target picture is a closed control loop around every AI action. What already runs today is in the entry path below — with the status the implementation registry reports.',
} as const;

export const GOVERNANCE_OS_LOOP: readonly {
  step: string;
  title: string;
  /** Gesetzt → Badge aus `STATUS_LABEL`; ohne Statuswert keine Zusage. */
  status?: ImplementationStatus;
}[] = [
  { step: 'OBSERVE', title: 'Beobachten' },
  { step: 'EVALUATE', title: 'Bewerten' },
  { step: 'DECIDE', title: 'Entscheiden' },
  { step: 'ACT', title: 'Handeln' },
  { step: 'VERIFY', title: 'Verifizieren' },
  { step: 'RECORD', title: 'Nachweisen' },
  { step: 'LEARN', title: 'Governed Evolution', status: 'coming-soon' },
];

/**
 * Einstiegspfad unter dem Loop. Der Status jeder Stufe kommt aus
 * `src/product/implementation-status.ts` über `statusId` — ein Statuswechsel
 * dort ändert die Landing, ohne dass hier Copy angefasst wird.
 */
export const GOVERNANCE_OS_ENTRY_PATH: readonly {
  label: string;
  statusId: string;
}[] = [
  { label: 'Scan', statusId: 'free-audit' },
  { label: 'Governance Core', statusId: 'governance-runtime-core' },
  { label: 'Kontrollierte Bots und Agenten', statusId: 'agent-governance' },
  { label: 'Agent OS Premium', statusId: 'agent-os-mesh-specialists' },
];

/** Grenze der Agenten-Ausführung — Kernsatz der Architektur-Sektion. */
export const AGENT_RUNTIME_BOUNDARY =
  'Agenten dürfen handeln — aber nur innerhalb der Governance-Runtime.' as const;

export const AGENT_GOVERNANCE_RUNTIME_SUMMARY = {
  de: 'Werkzeugzugriffe, Berechtigungen, Risikoklassen, Human-in-the-loop-Freigaben, Budget- und Quotenlimits, Datenzugriffe, Provider-Auswahl, Ausführungsrichtlinien und Evidence-Logs.',
  en: 'Tool access, permissions, risk classes, human-in-the-loop approvals, budget/quota limits, data access, provider selection, execution policies, and evidence logs.',
} as const;

export const AGENT_GOVERNANCE_RUNTIME_EXAMPLE = {
  de: 'Beispiel: Ein Security-Agent erkennt eine Schwachstelle; eine Änderung am Produktionssystem erfolgt erst nach Policy-Entscheidung und — falls gefordert — menschlicher Freigabe.',
  en: 'Example: A security agent may detect a vulnerability; it may change a production system only after policy evaluation and, if required, human approval.',
} as const;

export const PROVIDER_PLANNED_BADGE = {
  de: 'Geplant',
  en: 'Planned',
} as const;

/** Live sichtbare Providerpfade der Landing (getrennt von Roadmap-Pfaden). */
export const HOMEPAGE_PROVIDERS = [
  { name: 'OpenAI', note: 'Cloud' },
  { name: 'Anthropic · Claude', note: 'Cloud' },
  { name: 'Google · Gemini', note: 'Cloud' },
  { name: 'Eigene Modelle', note: 'Lokal / EU-betrieben' },
] as const;

/** Geplante Providerpfade — bewusst getrennt von live angebundenen Providern. */
export const HOMEPAGE_PLANNED_PROVIDERS = [
  { name: 'Mistral', note: 'Roadmap · noch nicht live angebunden' },
  { name: 'STACKIT', note: 'Roadmap · noch nicht live angebunden' },
  { name: 'Future models', note: 'Roadmap · unter derselben Governance-Schicht' },
] as const;

const LIVE_PROVIDER_NAMES = HOMEPAGE_PROVIDERS.map((provider) => provider.name).join(', ');
const PLANNED_PROVIDER_NAMES = HOMEPAGE_PLANNED_PROVIDERS.map((provider) => provider.name).join(', ');

export const PROVIDER_NEUTRALITY_SUMMARY = {
  de: `${LIVE_PROVIDER_NAMES} laufen heute unter derselben Governance-Schicht; ${PLANNED_PROVIDER_NAMES} sind als Providerpfade geplant.`,
  en: `${LIVE_PROVIDER_NAMES} run today under the same governance layer; ${PLANNED_PROVIDER_NAMES} are planned as provider paths.`,
} as const;

export const PROVIDER_PLANNED_DISCLAIMER = {
  de: 'Geplant markiert Optionen, die als Provider-Pfad vorgesehen, aber noch nicht live angebunden sind.',
  en: 'Planned marks options that are intended as provider paths but are not live integrations yet.',
} as const;

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

/**
 * Ein `statusId` ohne Eintrag in der Registry darf nicht still auf einen
 * Default zurückfallen — dann stünde ein erfundener Status auf der Startseite.
 */
const UNRESOLVED_ENTRY_STATUS_IDS = GOVERNANCE_OS_ENTRY_PATH
  .filter((stage) => getImplementation(stage.statusId) === undefined)
  .map((stage) => stage.statusId);

if (UNRESOLVED_ENTRY_STATUS_IDS.length > 0) {
  throw new Error(
    'hero-content.ts: GOVERNANCE_OS_ENTRY_PATH verweist auf unbekannte IDs in ' +
      `implementation-status.ts: ${UNRESOLVED_ENTRY_STATUS_IDS.join(', ')}`,
  );
}
