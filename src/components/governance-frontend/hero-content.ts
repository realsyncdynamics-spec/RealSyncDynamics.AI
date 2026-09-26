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
 * Substring der sichtbaren H1 auf `/` („Das Kontrollsystem für Ihre
 * Unternehmens-KI.", `src/i18n/handoff.ts`, Positionierung 2026-09-26).
 * Genutzt von tests/e2e/public-routes.spec.ts (FE-001).
 */
export const GOVERNANCE_AI_HERO_TEST_SUBSTRING = 'Kontrollsystem' as const;

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
 * Startseite `/` — Positionierung 2026-09-26 (B2B-Funnel).
 *
 * Reihenfolge: Problem → Governance-Modell → Governance-Check → Agent
 * Governance → Provider-Neutralität → Evidence → Prinzipien → Zielgruppen.
 *
 * Claim-Regel: Jede Aussage hier ist durch Code belegt (Belege im PR). Der
 * `status` einer Stufe kommt aus `src/product/implementation-status.ts` —
 * wer dort etwas zurückstuft, muss es hier mitziehen.
 */

/** Wiedererkennung — sachlich, ohne Schadenssummen. */
export const HOMEPAGE_PROBLEM_PAINS = [
  'Mitarbeitende nutzen mehrere KI-Anbieter parallel.',
  'Sensible Informationen landen möglicherweise in unterschiedlichen Systemen.',
  'Einzelne Teams bauen eigene Automationen.',
  'Erste Agenten führen selbstständig Aktionen aus.',
  'Verantwortlichkeiten sind über Teams verteilt.',
  'Freigaben laufen manuell über Chat oder E-Mail.',
  'Niemand kann zentral beantworten, welche Regeln für welche KI gelten.',
  'Im Nachhinein fehlt eine vollständige Nachweiskette.',
] as const;

export type HomepageStageStatus = 'live' | 'preview';

/** Governance-Modell: technische Funktion → Geschäftsnutzen. */
export const HOMEPAGE_GOVERNANCE_STAGES: readonly {
  id: string;
  step: string;
  title: string;
  body: string;
  status: HomepageStageStatus;
}[] = [
  {
    id: 'discover',
    step: 'DISCOVER',
    title: 'Wissen, welche KI tatsächlich eingesetzt wird.',
    body: 'Ein zentrales Inventar bekannter KI-Systeme, Anbieter, Anwendungen und Verantwortlichkeiten.',
    status: 'live',
  },
  {
    id: 'assess',
    step: 'ASSESS',
    title: 'Risiken erkennen, bevor KI produktiv eskaliert.',
    body: 'Anwendungen werden nach definierten Kriterien bewertet — Handlungsbedarf wird sichtbar.',
    status: 'live',
  },
  {
    id: 'govern',
    step: 'GOVERN',
    title: 'Festlegen, wer was mit welcher KI tun darf.',
    body: 'Policies, Rollen und Freigaben steuern sensible oder kritische Aktionen.',
    status: 'live',
  },
  {
    id: 'execute',
    step: 'EXECUTE',
    title: 'Agenten handeln — innerhalb definierter Grenzen.',
    body: 'Vor der Ausführung stehen Identitäts-, Tenant-, Policy-, Risiko- und bei Bedarf Freigabeprüfung.',
    status: 'preview',
  },
  {
    id: 'prove',
    step: 'PROVE',
    title: 'Nachweisen, was tatsächlich passiert ist.',
    body: 'Entscheidungen, Freigaben und Ausführungen können hash-verkettet dokumentiert werden.',
    status: 'live',
  },
] as const;

/** Authority Chain — serverseitige Reihenfolge einer Agenten-Aktion. */
export const HOMEPAGE_AUTHORITY_CHAIN: readonly { step: string; body: string; conditional?: boolean }[] = [
  { step: 'Request', body: 'Mensch oder Agent möchte eine Aktion ausführen.' },
  { step: 'Identity', body: 'Wer fragt an — authentifiziert, nicht behauptet.' },
  { step: 'Tenant', body: 'Welcher Mandant — serverseitig abgeleitet, nicht vom Client übernommen.' },
  { step: 'Policy', body: 'Welche Regel gilt für diese Aktion?' },
  { step: 'Risk', body: 'Wie kritisch ist sie im Kontext?' },
  { step: 'Approval', body: 'Menschliche Freigabe, wenn die Policy sie verlangt.', conditional: true },
  { step: 'Execution', body: 'Erst jetzt handelt der Execution-Provider.' },
  { step: 'Verification', body: 'Ergebnis gegen die Entscheidung prüfen.' },
  { step: 'Evidence', body: 'Entscheidung und Ausführung landen in der Nachweiskette.' },
] as const;

export const HOMEPAGE_AGENT_PRINCIPLES = [
  'Der Agent entscheidet nicht selbst über seine Berechtigung.',
  'Policies und Tenant-Zuordnung bleiben serverseitig autoritativ.',
  'Frontend-State, LocalStorage oder Provider-Antworten sind nie Governance-Authority.',
] as const;

/**
 * Serverseitig angebundene Provider (Adapter in `supabase/functions/_shared`).
 * Grok/xAI und Mistral sind nicht angebunden und stehen deshalb nicht hier.
 */
export const HOMEPAGE_PROVIDERS = [
  { name: 'OpenAI', note: 'Cloud' },
  { name: 'Anthropic · Claude', note: 'Cloud' },
  { name: 'Google · Gemini', note: 'Cloud · eingeschränkt' },
  { name: 'Eigene Modelle · Ollama', note: 'EU-lokal' },
] as const;

export const HOMEPAGE_EVIDENCE_FLOW = [
  'Entscheidung',
  'Freigabe',
  'Ausführung',
  'Verifikation',
  'Evidence',
] as const;

/** Technische Prinzipien statt Siegel — jedes durch Code belegt. */
export const HOMEPAGE_TRUST_PRINCIPLES = [
  {
    title: 'Tenant-Isolation',
    body: 'Row-Level-Security in der Datenbank trennt Mandanten — nicht nur die App-Logik.',
  },
  {
    title: 'Serverseitige Autorisierung',
    body: 'Berechtigungen prüfen Edge Functions; privilegierte Schlüssel verlassen nie den Server.',
  },
  {
    title: 'Policy Gates',
    body: 'Entscheidungen: erlauben, warnen, blockieren, Freigabe verlangen — beobachtend oder durchsetzend konfigurierbar.',
  },
  {
    title: 'Human Approval',
    body: 'Freigaben nur durch berechtigte Rollen; jede Entscheidung wird protokolliert.',
  },
  {
    title: 'Evidence Logging',
    body: 'SHA-256-verkettete Einträge, gegen nachträgliche Änderung per Datenbank-Trigger gesperrt, mit Integritätsprüfung.',
  },
  {
    title: 'Provider Separation',
    body: 'Die Policy-Entscheidung liegt außerhalb der Modell-Adapter — kein Provider bewertet sich selbst.',
  },
] as const;

/** Primärer ICP — Unternehmen mit mehreren KI-Systemen oder Automationen. */
export const HOMEPAGE_AUDIENCES = [
  {
    title: 'KMU & Mid-Market',
    body: 'Mehrere KI-Anbieter im Einsatz, aber keine zentrale Sicht auf Regeln und Verantwortliche.',
  },
  {
    title: 'Agenturen & Tech-Dienstleister',
    body: 'Komplexe KI-Workflows für Kunden — mit nachweisbaren Freigaben statt Chat-Absprachen.',
  },
  {
    title: 'Teams mit ersten Agenten',
    body: 'Automationen und Agenten gehen produktiv — Governance und Nachweisbarkeit müssen mitwachsen.',
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
