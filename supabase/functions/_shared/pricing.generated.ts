// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  AUTOMATISCH GENERIERT — NICHT BEARBEITEN                             ║
// ║                                                                       ║
// ║  Quelle:    shared/pricing.ts                                         ║
// ║  Generator: scripts/sync-shared-pricing.mjs  (npm run sync:pricing)   ║
// ║                                                                       ║
// ║  Änderungen ausschließlich in shared/pricing.ts vornehmen und danach  ║
// ║  `npm run sync:pricing` ausführen. Der Drift-Test in                  ║
// ║  test/config/pricing-ssot.test.ts schlägt sonst fehl.                 ║
// ╚═══════════════════════════════════════════════════════════════════════╝

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SINGLE SOURCE OF TRUTH — Produkt-, Preis- und Berechtigungsmodell
 * ══════════════════════════════════════════════════════════════════════════
 *
 * RealSyncDynamics.AI ist eine **AI Governance Runtime** — kein
 * DSGVO-Generator, kein Cookie-Scanner, kein Website-Checker.
 *
 * Diese Datei ist die EINZIGE gültige Quelle für:
 *   - Plan-Namen und Plan-Keys
 *   - Preise (monatlich + jährlich)
 *   - Runtime-Limits (Bots, Antworten, Domains, Kanäle, Automation-Runs, …)
 *   - Modul-Freischaltungen (GOVERN / AUTOMATE / ENGAGE)
 *   - Berechtigungen (permissions)
 *   - Feature-Listen (gruppiert in vier Bereiche)
 *   - Add-ons
 *
 * ── Verbindliche Regeln ───────────────────────────────────────────────────
 *  1. Diese Datei hat KEINE Imports und KEINE Laufzeit-Abhängigkeiten
 *     (kein `import.meta.env`, kein Node, kein DOM). Sie muss unverändert
 *     in Browser, Node, Vitest UND Deno (Supabase Edge Functions) laufen.
 *  2. Der Deno-Zwilling `supabase/functions/_shared/pricing.generated.ts`
 *     wird per `npm run sync:pricing` aus dieser Datei erzeugt. Ein
 *     Drift-Test (`test/config/pricing-ssot.test.ts`) erzwingt Identität.
 *  3. Preise dürfen NIRGENDWO sonst hart codiert werden — weder im
 *     Frontend, noch im Backend, noch in Stripe-Mappings, noch in Docs.
 *  4. Berechtigungen werden AUSSCHLIESSLICH über `plan.permissions`,
 *     `plan.modules`, `plan.limits` abgeleitet — niemals über
 *     String-Vergleiche wie `if (plan === 'agency')`.
 *  5. Stripe-Price-IDs stehen NICHT in dieser Datei. Sie werden
 *     serverseitig aus `public.products.default_for_plan_key` aufgelöst.
 *     Diese Datei liefert nur den kanonischen `planKey` als Bindeglied.
 *
 * ── Historie ──────────────────────────────────────────────────────────────
 *  2026-08: Governance-Refactor. Der Plan „Scale" wurde in „Partner"
 *  umbenannt. Der Begriff „Scale" ist im gesamten Produkt untersagt.
 *  Bestandsdaten (DB-Zeilen, Stripe-Metadaten) mit `scale` werden über
 *  `normalizePlanKey()` transparent auf `partner` abgebildet.
 */

// ─────────────────────────────────────────────────────────────────────────
//  Produktbereiche
// ─────────────────────────────────────────────────────────────────────────

/** Die drei Produktbereiche der Governance Runtime. */
export type ProductArea = 'govern' | 'automate' | 'engage';

export interface ProductAreaDefinition {
  id: ProductArea;
  /** Marketing-Label (immer Großschreibung: GOVERN / AUTOMATE / ENGAGE) */
  label: string;
  /** Ein-Satz-Beschreibung für Landing/Pricing */
  summary: string;
  /** Modul-IDs, die zu diesem Bereich gehören */
  modules: ModuleId[];
}

/** Alle Module der Plattform, nach Produktbereich gruppiert. */
export type GovernModuleId =
  | 'dsgvo'
  | 'eu_ai_act'
  | 'nis2'
  | 'dora'
  | 'iso_27001'
  | 'tisax'
  | 'policy_engine'
  | 'evidence_vault'
  | 'audit_center'
  | 'risk_register'
  | 'monitoring'
  | 'compliance_reports';

export type AutomateModuleId =
  | 'scheduler'
  | 'workflows'
  | 'n8n'
  | 'kodee'
  | 'bulk_jobs'
  | 'automation_engine'
  | 'alerts'
  | 'drift_detection'
  | 'remediation'
  | 'background_jobs';

export type EngageModuleId =
  | 'ai_bots'
  | 'voice'
  | 'whatsapp'
  | 'telegram'
  | 'website_chat'
  | 'api'
  | 'webhooks'
  | 'human_handoff'
  | 'multi_channel_messaging';

export type ModuleId = GovernModuleId | AutomateModuleId | EngageModuleId;

export interface ModuleDefinition {
  id: ModuleId;
  area: ProductArea;
  /** Anzeigename (deutsch, außer bei Standard-Fachbegriffen) */
  name: string;
  description: string;
  /** Lucide-Icon-Name — einheitliches Icon-Set über alle Oberflächen */
  icon: string;
  /** Ist das Modul ein regulatorisches Rahmenwerk (Policy Pack)? */
  policyPack?: boolean;
}

export const GOVERN_MODULES: ModuleDefinition[] = [
  { id: 'dsgvo', area: 'govern', name: 'DSGVO', description: 'Datenschutz-Grundverordnung: Verarbeitungsverzeichnis, Betroffenenrechte, Prüfpfad.', icon: 'Shield', policyPack: true },
  { id: 'eu_ai_act', area: 'govern', name: 'EU AI Act', description: 'Risikoklassifizierung von KI-Systemen, Transparenzpflichten, technische Dokumentation.', icon: 'Brain', policyPack: true },
  { id: 'nis2', area: 'govern', name: 'NIS2', description: 'Meldepflichten und Fristen (24 h / 72 h / 1 Monat), Sicherheitsmaßnahmen.', icon: 'Siren', policyPack: true },
  { id: 'dora', area: 'govern', name: 'DORA', description: 'Digitale operationale Resilienz für Finanzunternehmen, IKT-Drittparteienrisiko.', icon: 'Landmark', policyPack: true },
  { id: 'iso_27001', area: 'govern', name: 'ISO 27001', description: 'Informationssicherheits-Managementsystem, Annex-A-Kontrollen.', icon: 'Lock', policyPack: true },
  { id: 'tisax', area: 'govern', name: 'TISAX', description: 'Automotive-Informationssicherheit, VDA-ISA-Kontrollkatalog.', icon: 'Car', policyPack: true },
  { id: 'policy_engine', area: 'govern', name: 'Policy Engine', description: 'Regelwerk als Code: Richtlinien definieren, versionieren und zur Laufzeit durchsetzen.', icon: 'Scale' },
  { id: 'evidence_vault', area: 'govern', name: 'Evidence Vault', description: 'Manipulationssicherer Nachweisspeicher mit Hash-Chain, Retention und Legal Hold.', icon: 'Archive' },
  { id: 'audit_center', area: 'govern', name: 'Audit Center', description: 'Prüfpfad, Audit-Läufe und exportfähige Nachweispakete für Prüfer.', icon: 'ClipboardCheck' },
  { id: 'risk_register', area: 'govern', name: 'Risk Register', description: 'Zentrales Risikoregister mit Bewertung, Eigentümern und Maßnahmenverfolgung.', icon: 'AlertTriangle' },
  { id: 'monitoring', area: 'govern', name: 'Monitoring', description: 'Kontinuierliche Runtime-Überwachung von Assets, Kontrollen und SLOs.', icon: 'Activity' },
  { id: 'compliance_reports', area: 'govern', name: 'Compliance Reports', description: 'Berichte je Rahmenwerk — PDF/JSON, revisionssicher signiert.', icon: 'FileText' },
];

export const AUTOMATE_MODULES: ModuleDefinition[] = [
  { id: 'scheduler', area: 'automate', name: 'Scheduler', description: 'Geplante Läufe (täglich/wöchentlich/monatlich) mit Prioritäts-Queue.', icon: 'CalendarClock' },
  { id: 'workflows', area: 'automate', name: 'Workflows', description: 'Mehrstufige Governance-Abläufe mit Freigaben und Eskalation.', icon: 'GitBranch' },
  { id: 'n8n', area: 'automate', name: 'n8n', description: 'Anbindung an n8n: Webhook-Trigger, Workflow-Läufe, Rückschreiben von Ergebnissen.', icon: 'Workflow' },
  { id: 'kodee', area: 'automate', name: 'Kodee', description: 'Server-Operations-Assistent (SSH): Status, Logs, TLS/DNS mit Risiko-Advisor.', icon: 'Terminal' },
  { id: 'bulk_jobs', area: 'automate', name: 'Bulk Jobs', description: 'Massenläufe über viele Domains: CSV-Import, Queue, Retry.', icon: 'Layers' },
  { id: 'automation_engine', area: 'automate', name: 'Automation Engine', description: 'Ausführungs-Engine für Governance-Skills mit Kontingent und Protokollierung.', icon: 'Cpu' },
  { id: 'alerts', area: 'automate', name: 'Alerts', description: 'Benachrichtigungen bei neuen Findings — E-Mail, Slack, Teams, Webhook.', icon: 'Bell' },
  { id: 'drift_detection', area: 'automate', name: 'Drift Detection', description: 'Erkennt Abweichungen vom genehmigten Soll-Zustand zwischen zwei Läufen.', icon: 'TrendingUp' },
  { id: 'remediation', area: 'automate', name: 'Remediation', description: 'Vorbereitete Maßnahmen mit Code-Snippets und Review-Pflicht.', icon: 'Wrench' },
  { id: 'background_jobs', area: 'automate', name: 'Background Jobs', description: 'Langlaufende Hintergrundaufgaben mit Fortschritt und Wiederaufnahme.', icon: 'Cog' },
];

export const ENGAGE_MODULES: ModuleDefinition[] = [
  { id: 'ai_bots', area: 'engage', name: 'AI Bots', description: 'Governance-Bots mit Transparenzhinweis, Antwort-Logging und Risiko-Tags.', icon: 'Bot' },
  { id: 'voice', area: 'engage', name: 'Voice', description: 'Sprachkanal mit IVR, Speech-to-Text und Text-to-Speech.', icon: 'Phone' },
  { id: 'whatsapp', area: 'engage', name: 'WhatsApp', description: 'WhatsApp-Business-Integration mit Compliance-Badges und Media-Support.', icon: 'MessageCircle' },
  { id: 'telegram', area: 'engage', name: 'Telegram', description: 'Telegram-Bot-Kanal mit identischem Governance-Protokoll.', icon: 'Send' },
  { id: 'website_chat', area: 'engage', name: 'Website Chat', description: 'Eingebetteter Chat auf der eigenen Website, DSGVO-konform ausgeliefert.', icon: 'MessageSquare' },
  { id: 'api', area: 'engage', name: 'API', description: 'REST-API für Scans, Nachweise, Risiken und Automationsläufe.', icon: 'Code' },
  { id: 'webhooks', area: 'engage', name: 'Webhooks', description: 'Signierte Ereignis-Zustellung an eigene Systeme und CI/CD.', icon: 'Webhook' },
  { id: 'human_handoff', area: 'engage', name: 'Human Handoff', description: 'Übergabe an Menschen mit Eskalationsstufen und Protokollierung.', icon: 'UserCheck' },
  { id: 'multi_channel_messaging', area: 'engage', name: 'Multi Channel Messaging', description: 'Ein Bot, viele Kanäle — konsistente Antworten und ein Prüfpfad.', icon: 'Share2' },
];

export const ALL_MODULES: ModuleDefinition[] = [
  ...GOVERN_MODULES,
  ...AUTOMATE_MODULES,
  ...ENGAGE_MODULES,
];

export const PRODUCT_AREAS: ProductAreaDefinition[] = [
  {
    id: 'govern',
    label: 'GOVERN',
    summary: 'Rahmenwerke, Richtlinien, Nachweise und Prüfpfad — die regulatorische Grundlage der Runtime.',
    modules: GOVERN_MODULES.map((m) => m.id),
  },
  {
    id: 'automate',
    label: 'AUTOMATE',
    summary: 'Planung, Workflows und Maßnahmen — Governance läuft kontinuierlich statt projektweise.',
    modules: AUTOMATE_MODULES.map((m) => m.id),
  },
  {
    id: 'engage',
    label: 'ENGAGE',
    summary: 'Kanäle, Bots und Schnittstellen — Governance wirkt dort, wo Menschen und Systeme interagieren.',
    modules: ENGAGE_MODULES.map((m) => m.id),
  },
];

/** Policy Packs = regulatorische Rahmenwerke innerhalb von GOVERN. */
export const POLICY_PACK_IDS: GovernModuleId[] = GOVERN_MODULES
  .filter((m) => m.policyPack)
  .map((m) => m.id as GovernModuleId);

// ─────────────────────────────────────────────────────────────────────────
//  Pläne
// ─────────────────────────────────────────────────────────────────────────

/**
 * Die sechs Abo-Pläne plus die Einmalprodukte.
 *
 * Die Abo-Leiter besteht aus genau sechs Rängen (`PLAN_ORDER`):
 * free → starter → growth → agency → enterprise → partner.
 * Einmalprodukte (`purchaseMode: 'one_time'`, z.B. `governance_launch`)
 * sind bewusst KEIN Rang dieser Leiter: sie werden zusätzlich zu einem
 * Abo gekauft, ersetzen es nicht, und nehmen deshalb weder an
 * `planRank()`/`isUpgrade()` noch an den Monotonie-Invarianten teil.
 */
export type PlanId =
  | 'free' | 'starter' | 'growth' | 'agency' | 'enterprise' | 'partner'
  | 'governance_launch';

/** Plan-Key inkl. Jahresvariante. Bindeglied zu Stripe und DB. */
export type PlanKey =
  | 'free_audit'
  | 'starter' | 'starter_yearly'
  | 'growth' | 'growth_yearly'
  | 'agency' | 'agency_yearly'
  | 'enterprise' | 'enterprise_yearly'
  | 'partner' | 'partner_yearly'
  | 'governance_launch';

/** `'one_time'` steht für einen Einmalkauf ohne wiederkehrende Abrechnung. */
export type BillingInterval = 'none' | 'month' | 'year' | 'one_time';

/**
 * Wie ein Plan erworben wird.
 *
 * `one_time` erzeugt eine Stripe-Checkout-Session im Modus `payment`
 * (statt `subscription`) — es entsteht keine Subscription und keine
 * Verlängerung. Der Kauf wird als `entitlement_grants`-Zeile festgehalten
 * und ergänzt die Entitlements des laufenden Abos.
 */
export type PurchaseMode = 'free' | 'checkout' | 'inquiry' | 'one_time';

export type ChannelId = 'website' | 'whatsapp' | 'telegram' | 'slack' | 'teams' | 'email' | 'voice';

/**
 * Runtime-Limits. `-1` bedeutet durchgängig „unbegrenzt".
 * Es gibt bewusst KEINE `null`-Werte — jeder Konsument darf sich auf
 * `number` verlassen.
 */
export interface PlanLimits {
  /** Produktive Governance-Bots */
  bots: number;
  /** Bot-Antworten pro Monat */
  answersPerMonth: number;
  /** Überwachte Domains / Assets */
  domains: number;
  /** Automationsläufe pro Monat */
  automationRunsPerMonth: number;
  /** Benutzer-Sitze */
  seats: number;
  /** API-Aufrufe pro Monat (0 = kein API-Zugriff) */
  apiCallsPerMonth: number;
  /** Verwaltbare Mandanten (1 = kein Multi-Tenant) */
  tenants: number;
  /** Nachweisspeicher in GB */
  evidenceStorageGb: number;
  /** Audit-Berichte pro Monat */
  auditReportsPerMonth: number;
  /** Gleichzeitige Behebungspläne */
  remediationPlans: number;
  /** Bulk-Jobs pro Monat */
  bulkJobsPerMonth: number;
  /** API-Schlüssel */
  apiKeys: number;
}

/**
 * Berechtigungen. Ausschließlich hierüber wird im Backend und im Frontend
 * entschieden — nie über Plan-Namen.
 */
export interface PlanPermissions {
  /** Geplante Läufe konfigurieren */
  scheduler: boolean;
  /** REST-API nutzen */
  api: boolean;
  /** Webhooks empfangen/registrieren */
  webhooks: boolean;
  /** Berichte mit eigenem Branding */
  whiteLabelReports: boolean;
  /** Vollständiges White-Label inkl. Dashboard und Subdomain */
  whiteLabelDashboard: boolean;
  /** Mehrere Mandanten verwalten */
  multiTenant: boolean;
  /** Evidence Vault nutzen */
  evidenceVault: boolean;
  /** Nachweispakete exportieren */
  auditExport: boolean;
  /** Single Sign-On */
  sso: boolean;
  /** Massenläufe */
  bulkOperations: boolean;
  /** Herkunftsnachweis (C2PA-angelehnt) signieren */
  provenanceSigning: boolean;
  /** Priorisierter Support / SLA */
  prioritySupport: boolean;
}

export type SupportLevel = 'community' | 'email' | 'priority' | 'dedicated';

/** Die vier — und nur diese vier — Feature-Gruppen. Keine ungeordneten Listen. */
export type FeatureGroupId =
  | 'audit_evidence'
  | 'ai_governance'
  | 'automation_ops'
  | 'multi_tenant_reseller';

export interface FeatureGroupDefinition {
  id: FeatureGroupId;
  label: string;
  summary: string;
  icon: string;
}

export const FEATURE_GROUPS: FeatureGroupDefinition[] = [
  {
    id: 'audit_evidence',
    label: 'Audit & Evidence',
    summary: 'Prüfpfad, Nachweise, Exporte — was Sie einem Prüfer vorlegen.',
    icon: 'ClipboardCheck',
  },
  {
    id: 'ai_governance',
    label: 'AI Governance',
    summary: 'Rahmenwerke, Richtlinien und Risiken über alle KI-Systeme hinweg.',
    icon: 'Brain',
  },
  {
    id: 'automation_ops',
    label: 'Automation & Ops',
    summary: 'Laufender Betrieb: Planung, Erkennung, Maßnahmen, Alarmierung.',
    icon: 'Cog',
  },
  {
    id: 'multi_tenant_reseller',
    label: 'Multi Tenant & Reseller',
    summary: 'Mandantentrennung, White-Label und Weiterverkauf.',
    icon: 'Building2',
  },
];

/** Feature-Liste eines Plans, immer nach den vier Gruppen sortiert. */
export type PlanFeatureMatrix = Record<FeatureGroupId, string[]>;

export interface PlanPrice {
  /** Monatspreis in Euro (0 für Free und für Einmalprodukte) */
  monthlyEur: number;
  /**
   * Jahrespreis in Euro. `null` = keine Jahresvariante (nur Free).
   * Rabattlogik: 12 Monate zum Preis von 10, bei Agency/Partner auf runde
   * Beträge abgerundet.
   */
  yearlyEur: number | null;
  /**
   * Einmalpreis in Euro. Nur für `purchaseMode: 'one_time'` gesetzt,
   * sonst `null`. Damit bleibt der Betrag auch für Einmalprodukte in der
   * SSoT und muss nirgendwo im Frontend hart codiert werden.
   */
  oneTimeEur: number | null;
}

export interface Plan {
  id: PlanId;
  /** Kanonischer Plan-Key der Monatsvariante (Bindeglied zu Stripe + DB) */
  planKey: PlanKey;
  /** Plan-Key der Jahresvariante, `null` wenn keine existiert */
  yearlyPlanKey: PlanKey | null;
  /** Anzeigename — exakt so, nirgendwo abweichend */
  name: string;
  /** Ergebnis-orientierte Headline (was der Kunde bekommt) */
  outcomeHeadline: string;
  /** Technische Subheadline (wie die Runtime das leistet) */
  technicalSubheadline: string;
  price: PlanPrice;
  currency: 'EUR';
  purchaseMode: PurchaseMode;
  /** Hebt die Karte im Grid hervor */
  highlight: boolean;
  /** Badges auf der Karte */
  badges: string[];
  /** CTA-Label. Das Ziel wird zentral über `checkoutHrefForPlan()` erzeugt. */
  ctaLabel: string;
  limits: PlanLimits;
  /** Freigeschaltete Kanäle für Bots/Messaging */
  channels: ChannelId[];
  /** Freigeschaltete Module (nur IDs, die in ALL_MODULES existieren) */
  modules: ModuleId[];
  permissions: PlanPermissions;
  support: SupportLevel;
  /** Add-on-IDs, die für diesen Plan buchbar sind */
  addons: AddOnId[];
  /** Feature-Bullets, gruppiert. Einzige Quelle für jede Feature-Liste. */
  features: PlanFeatureMatrix;
  /** Testphase in Tagen (0 = keine) */
  trialDays: number;
}

// ── Hilfsdefinitionen für die Matrix ──────────────────────────────────────

const ALL_CHANNELS: ChannelId[] = ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'];

const NO_PERMISSIONS: PlanPermissions = {
  scheduler: false,
  api: false,
  webhooks: false,
  whiteLabelReports: false,
  whiteLabelDashboard: false,
  multiTenant: false,
  evidenceVault: false,
  auditExport: false,
  sso: false,
  bulkOperations: false,
  provenanceSigning: false,
  prioritySupport: false,
};

function permissions(overrides: Partial<PlanPermissions>): PlanPermissions {
  return { ...NO_PERMISSIONS, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────
//  Der Plan-Katalog
// ─────────────────────────────────────────────────────────────────────────

export const PLANS: Plan[] = [
  // ── Free Audit — 0 € ────────────────────────────────────────────────────
  {
    id: 'free',
    planKey: 'free_audit',
    yearlyPlanKey: null,
    name: 'Free Audit',
    outcomeHeadline: 'Sehen Sie in 90 Sekunden, wo Ihre Governance-Lücken liegen.',
    technicalSubheadline: 'Einmaliger Runtime-Scan Ihrer Domain mit Governance Score, Top-Risiken und Planempfehlung.',
    price: { monthlyEur: 0, yearlyEur: null, oneTimeEur: null },
    currency: 'EUR',
    purchaseMode: 'free',
    highlight: false,
    badges: [],
    ctaLabel: 'Kostenlosen Audit starten',
    limits: {
      bots: 0,
      answersPerMonth: 0,
      domains: 1,
      automationRunsPerMonth: 0,
      seats: 1,
      apiCallsPerMonth: 0,
      tenants: 1,
      evidenceStorageGb: 0.5,
      auditReportsPerMonth: 1,
      remediationPlans: 0,
      bulkJobsPerMonth: 0,
      apiKeys: 0,
    },
    channels: [],
    modules: ['dsgvo', 'audit_center', 'compliance_reports'],
    permissions: permissions({}),
    support: 'community',
    addons: [],
    features: {
      audit_evidence: [
        'Runtime-Scan einer Domain mit Governance Score 0–100',
        'Top-3-Risiken mit Paragraphenbezug',
        'Kompakter PDF-Bericht',
        'Prüfpfad einsehbar (kein Export)',
      ],
      ai_governance: [
        'DSGVO-Basisprüfung',
        'Automatische Planempfehlung auf Basis des Scores',
      ],
      automation_ops: [
        'Kein Account, kein Setup erforderlich',
      ],
      multi_tenant_reseller: [],
    },
    trialDays: 0,
  },

  // ── Starter — 79 € ──────────────────────────────────────────────────────
  {
    id: 'starter',
    planKey: 'starter',
    yearlyPlanKey: 'starter_yearly',
    name: 'Starter',
    outcomeHeadline: 'Ein nachweisbares Governance-Fundament, das jeden Prüfer überzeugt.',
    technicalSubheadline: 'Kontinuierlicher DSGVO- und AI-Act-Scan mit lückenloser Hash-Chain und exportierbarem Prüfpfad.',
    price: { monthlyEur: 79, yearlyEur: 790, oneTimeEur: null },
    currency: 'EUR',
    purchaseMode: 'checkout',
    highlight: false,
    badges: [],
    ctaLabel: '14 Tage kostenlos testen',
    limits: {
      bots: 1,
      answersPerMonth: 500,
      domains: 1,
      automationRunsPerMonth: 25,
      seats: 1,
      apiCallsPerMonth: 0,
      tenants: 1,
      evidenceStorageGb: 2,
      auditReportsPerMonth: 2,
      remediationPlans: 5,
      bulkJobsPerMonth: 0,
      apiKeys: 0,
    },
    channels: ['website'],
    modules: [
      'dsgvo', 'eu_ai_act',
      'evidence_vault', 'audit_center', 'monitoring', 'compliance_reports',
      'automation_engine', 'alerts',
      'ai_bots', 'website_chat',
    ],
    permissions: permissions({
      evidenceVault: true,
      auditExport: true,
    }),
    support: 'email',
    addons: [],
    features: {
      audit_evidence: [
        'Vollständiger DSGVO-Scan mit Paragraphenbezug',
        'Evidence Vault mit Hash-Chain-Verifizierung',
        'Audit-Export als PDF und JSON',
        'Lückenloser Prüfpfad über alle Läufe',
      ],
      ai_governance: [
        'Policy Packs: DSGVO und EU AI Act',
        'Generator für Datenschutzerklärung',
        'Technische Consent-Empfehlungen',
      ],
      automation_ops: [
        'Kontinuierliches Monitoring',
        'E-Mail-Alert bei neuen Findings',
        '25 Automationsläufe pro Monat',
        '1 Governance-Bot mit 500 Antworten (Website)',
      ],
      multi_tenant_reseller: [],
    },
    trialDays: 14,
  },

  // ── Growth — 249 € ──────────────────────────────────────────────────────
  {
    id: 'growth',
    planKey: 'growth',
    yearlyPlanKey: 'growth_yearly',
    name: 'Growth',
    outcomeHeadline: 'KI-Governance, die sich selbst überwacht — statt einmal im Jahr geprüft zu werden.',
    technicalSubheadline: 'Tägliche Runtime-Läufe mit Drift Detection, Risk Register und Policy Engine über drei Rahmenwerke.',
    price: { monthlyEur: 249, yearlyEur: 2490, oneTimeEur: null },
    currency: 'EUR',
    purchaseMode: 'checkout',
    highlight: true,
    badges: ['Empfohlen'],
    ctaLabel: '14 Tage kostenlos testen',
    limits: {
      bots: 2,
      answersPerMonth: 2_000,
      domains: 3,
      automationRunsPerMonth: 100,
      seats: 5,
      apiCallsPerMonth: 0,
      tenants: 1,
      evidenceStorageGb: 10,
      auditReportsPerMonth: 12,
      remediationPlans: 20,
      bulkJobsPerMonth: 0,
      apiKeys: 0,
    },
    channels: ['website', 'whatsapp', 'telegram'],
    modules: [
      'dsgvo', 'eu_ai_act', 'iso_27001',
      'policy_engine', 'evidence_vault', 'audit_center', 'risk_register', 'monitoring', 'compliance_reports',
      'automation_engine', 'alerts', 'workflows', 'drift_detection', 'remediation', 'background_jobs',
      'ai_bots', 'website_chat', 'whatsapp', 'telegram', 'multi_channel_messaging',
    ],
    permissions: permissions({
      evidenceVault: true,
      auditExport: true,
    }),
    support: 'priority',
    addons: ['response_pack', 'whatsapp', 'compliance_pack'],
    features: {
      audit_evidence: [
        'Alles aus Starter',
        'Evidence Vault mit Versionierung',
        'Bis zu 12 Audit-Berichte pro Monat',
        'Consent-Timing-Analyse (Requests vor Einwilligung)',
      ],
      ai_governance: [
        'Policy Packs: DSGVO, EU AI Act, ISO 27001',
        'Policy Engine mit versionierten Richtlinien',
        'AI Risk Register mit Bewertung und Eigentümern',
        'Governance Score je Rahmenwerk',
      ],
      automation_ops: [
        'Tägliches Monitoring mit Drift Detection',
        'Behebungsvorschläge mit Code-Snippets',
        '100 Automationsläufe pro Monat',
        '2 Governance-Bots mit 2.000 Antworten (Website, WhatsApp, Telegram)',
      ],
      multi_tenant_reseller: [],
    },
    trialDays: 14,
  },

  // ── Agency — 699 € ──────────────────────────────────────────────────────
  {
    id: 'agency',
    planKey: 'agency',
    yearlyPlanKey: 'agency_yearly',
    name: 'Agency',
    outcomeHeadline: 'Governance für viele Kunden gleichzeitig — automatisiert und mit Ihrem Logo.',
    technicalSubheadline: 'Scheduler, Bulk Jobs und REST-API über fünf Rahmenwerke, mit White-Label-Berichten und signiertem Herkunftsnachweis.',
    price: { monthlyEur: 699, yearlyEur: 6900, oneTimeEur: null },
    currency: 'EUR',
    purchaseMode: 'checkout',
    highlight: false,
    badges: ['Für Agenturen'],
    ctaLabel: '14 Tage kostenlos testen',
    limits: {
      bots: 10,
      answersPerMonth: 25_000,
      domains: 10,
      automationRunsPerMonth: 500,
      seats: 15,
      apiCallsPerMonth: 50_000,
      tenants: 1,
      evidenceStorageGb: 50,
      auditReportsPerMonth: 50,
      remediationPlans: 100,
      bulkJobsPerMonth: 100,
      apiKeys: 10,
    },
    channels: ALL_CHANNELS,
    modules: [
      'dsgvo', 'eu_ai_act', 'iso_27001', 'nis2', 'tisax',
      'policy_engine', 'evidence_vault', 'audit_center', 'risk_register', 'monitoring', 'compliance_reports',
      'automation_engine', 'alerts', 'workflows', 'drift_detection', 'remediation', 'background_jobs',
      'scheduler', 'n8n', 'kodee', 'bulk_jobs',
      'ai_bots', 'website_chat', 'whatsapp', 'telegram', 'voice', 'multi_channel_messaging',
      'api', 'webhooks', 'human_handoff',
    ],
    permissions: permissions({
      scheduler: true,
      api: true,
      webhooks: true,
      whiteLabelReports: true,
      evidenceVault: true,
      auditExport: true,
      bulkOperations: true,
      provenanceSigning: true,
      prioritySupport: true,
    }),
    support: 'priority',
    addons: ['response_pack', 'whatsapp', 'voice', 'compliance_pack', 'agency_bot_pack', 'white_label'],
    features: {
      audit_evidence: [
        'Alles aus Growth',
        'Evidence Vault Advanced: unveränderliche Snapshots, Retention, Legal Hold',
        'Herkunftsnachweis mit Ed25519-Signatur und Chain-of-Custody',
        'White-Label-Berichte mit eigenem Logo',
      ],
      ai_governance: [
        'Policy Packs: DSGVO, EU AI Act, ISO 27001, NIS2, TISAX',
        'Branchenbibliothek vorkonfigurierter Governance-Profile',
        'Governance Agents für Prüfungen und Maßnahmen (Review-pflichtig)',
      ],
      automation_ops: [
        'Scheduler für geplante Läufe mit Slack-/Teams-/Webhook-Alerts',
        'Bulk Jobs: Massen-Scan vieler Domains per CSV',
        'n8n-Anbindung und Kodee Server-Assistent',
        'REST-API und Webhooks für CI/CD',
        '500 Automationsläufe pro Monat',
        '10 Governance-Bots mit 25.000 Antworten (alle Kanäle inkl. Voice)',
      ],
      multi_tenant_reseller: [
        'White-Label-Berichte mit eigenem Branding',
        'Bis zu 10 Domains unter einem Konto',
      ],
    },
    trialDays: 14,
  },

  // ── Enterprise — 1.249 € ────────────────────────────────────────────────
  {
    id: 'enterprise',
    planKey: 'enterprise',
    yearlyPlanKey: 'enterprise_yearly',
    name: 'Enterprise',
    outcomeHeadline: 'Konzernweite Governance über alle sechs Rahmenwerke — mit SLA und SSO.',
    technicalSubheadline: 'Multi-Tenant-Runtime für bis zu 5 Organisationen, zentrale Rechteverwaltung und unbegrenzte geplante Läufe.',
    price: { monthlyEur: 1_249, yearlyEur: 12_490, oneTimeEur: null },
    currency: 'EUR',
    purchaseMode: 'checkout',
    highlight: false,
    badges: ['SLA 4 h'],
    ctaLabel: '14 Tage kostenlos testen',
    limits: {
      bots: 20,
      answersPerMonth: 50_000,
      domains: 25,
      automationRunsPerMonth: 2_000,
      seats: 50,
      apiCallsPerMonth: 250_000,
      tenants: 5,
      evidenceStorageGb: 200,
      auditReportsPerMonth: 200,
      remediationPlans: 500,
      bulkJobsPerMonth: 500,
      apiKeys: 50,
    },
    channels: ALL_CHANNELS,
    modules: [
      'dsgvo', 'eu_ai_act', 'iso_27001', 'nis2', 'tisax', 'dora',
      'policy_engine', 'evidence_vault', 'audit_center', 'risk_register', 'monitoring', 'compliance_reports',
      'automation_engine', 'alerts', 'workflows', 'drift_detection', 'remediation', 'background_jobs',
      'scheduler', 'n8n', 'kodee', 'bulk_jobs',
      'ai_bots', 'website_chat', 'whatsapp', 'telegram', 'voice', 'multi_channel_messaging',
      'api', 'webhooks', 'human_handoff',
    ],
    permissions: permissions({
      scheduler: true,
      api: true,
      webhooks: true,
      whiteLabelReports: true,
      whiteLabelDashboard: true,
      multiTenant: true,
      evidenceVault: true,
      auditExport: true,
      sso: true,
      bulkOperations: true,
      provenanceSigning: true,
      prioritySupport: true,
    }),
    support: 'dedicated',
    addons: ['response_pack', 'whatsapp', 'voice', 'compliance_pack', 'agency_bot_pack', 'white_label'],
    features: {
      audit_evidence: [
        'Alles aus Agency',
        'Audit Center Pro mit 200 Berichten pro Monat',
        'Evidence Vault Enterprise mit 200 GB Nachweisspeicher',
      ],
      ai_governance: [
        'Alle sechs Policy Packs: DSGVO, EU AI Act, ISO 27001, NIS2, TISAX, DORA',
        'Erweiterte Analysen und Risk Scoring',
        'Eigene Richtlinien und Kontrollkataloge',
      ],
      automation_ops: [
        'Unbegrenzter Scheduler für geplante Läufe',
        '2.000 Automationsläufe pro Monat',
        'API Premium mit 250.000 Aufrufen pro Monat',
        '20 Governance-Bots mit 50.000 Antworten (alle Kanäle)',
        'Priorisierter Support mit 4 h Reaktionszeit',
      ],
      multi_tenant_reseller: [
        'Multi-Tenant-Dashboard für bis zu 5 Organisationen',
        'Zentrale Benutzerverwaltung mit Rollen und Rechten',
        'Single Sign-On',
        'White-Label mit Branding, Logo und Farben',
      ],
    },
    trialDays: 14,
  },

  // ── Partner — 1.999 € ───────────────────────────────────────────────────
  {
    id: 'partner',
    planKey: 'partner',
    yearlyPlanKey: 'partner_yearly',
    name: 'Partner',
    outcomeHeadline: 'Verkaufen Sie Governance als eigenes Produkt — bis zu 50 Mandanten unter Ihrer Marke.',
    technicalSubheadline: 'Vollständig mandantengetrennte Runtime mit White-Label-Subdomain, eigenem Branding und voller API.',
    price: { monthlyEur: 1_999, yearlyEur: 19_000, oneTimeEur: null },
    currency: 'EUR',
    purchaseMode: 'inquiry',
    highlight: false,
    badges: ['Reseller', 'Multi Tenant'],
    // „Partner anfragen" folgt CTA.enterprise aus runtimeVocab.ts. Formen wie
    // „Partner-Gespräch" sind als Sales-Sprache untersagt (CI_FORBIDDEN_CTA).
    ctaLabel: 'Partner anfragen',
    limits: {
      bots: 50,
      answersPerMonth: 100_000,
      domains: 100,
      automationRunsPerMonth: 10_000,
      seats: 100,
      apiCallsPerMonth: 1_000_000,
      tenants: 50,
      evidenceStorageGb: 500,
      auditReportsPerMonth: 500,
      remediationPlans: -1,
      bulkJobsPerMonth: -1,
      apiKeys: -1,
    },
    channels: ALL_CHANNELS,
    modules: [
      'dsgvo', 'eu_ai_act', 'iso_27001', 'nis2', 'tisax', 'dora',
      'policy_engine', 'evidence_vault', 'audit_center', 'risk_register', 'monitoring', 'compliance_reports',
      'automation_engine', 'alerts', 'workflows', 'drift_detection', 'remediation', 'background_jobs',
      'scheduler', 'n8n', 'kodee', 'bulk_jobs',
      'ai_bots', 'website_chat', 'whatsapp', 'telegram', 'voice', 'multi_channel_messaging',
      'api', 'webhooks', 'human_handoff',
    ],
    permissions: permissions({
      scheduler: true,
      api: true,
      webhooks: true,
      whiteLabelReports: true,
      whiteLabelDashboard: true,
      multiTenant: true,
      evidenceVault: true,
      auditExport: true,
      sso: true,
      bulkOperations: true,
      provenanceSigning: true,
      prioritySupport: true,
    }),
    support: 'dedicated',
    addons: ['response_pack', 'whatsapp', 'voice', 'compliance_pack', 'agency_bot_pack', 'white_label'],
    features: {
      audit_evidence: [
        'Alles aus Enterprise',
        '500 GB Nachweisspeicher, 500 Audit-Berichte pro Monat',
        'Unbegrenzte Behebungspläne und Bulk Jobs',
      ],
      ai_governance: [
        'Alle sechs Policy Packs je Mandant getrennt aktivierbar',
        'Mandantenspezifische Richtlinien und Kontrollkataloge',
      ],
      automation_ops: [
        '10.000 Automationsläufe pro Monat',
        'Voller API-Zugriff mit 1 Mio. Aufrufen pro Monat',
        '50 Governance-Bots mit 100.000 Antworten, mandantengetrennt',
        'SLA 4 h auf Fehlermeldungen mit festem Ansprechpartner',
      ],
      multi_tenant_reseller: [
        'Multi-Tenant-Dashboard für bis zu 50 Mandanten',
        'White-Label-Subdomain je Mandant',
        'Vollständiges Branding: Logos, Farben, Texte',
        'Mandanten-Isolation mit Unterkonten',
        'Unbegrenzte API-Schlüssel',
      ],
    },
    trialDays: 0,
  },

  // ── Governance Launch — 349 € einmalig ──────────────────────────────────
  //
  // Einmalige Implementierungsleistung, KEIN Abo-Rang. Steht deshalb nicht
  // in `PLAN_ORDER` und nimmt an den Monotonie-Invarianten (Module/
  // Berechtigungen/Limits wachsen entlang der Leiter) nicht teil.
  //
  // Wirkung: Der Kauf wird als Grant in `entitlement_grants` festgehalten und
  // seine Entitlements werden von `tenant_entitlements()` per MAX() mit dem
  // laufenden Abo vereinigt — ein zahlender Growth-Kunde verliert also
  // nichts, wenn er zusätzlich Governance Launch bucht.
  {
    id: 'governance_launch',
    planKey: 'governance_launch',
    yearlyPlanKey: null,
    name: 'Governance Launch',
    outcomeHeadline: 'Einmalige Governance-Implementierung für Ihren ersten Anwendungsfall.',
    technicalSubheadline: 'Einmalige Einrichtung: Rahmenwerk-Konfiguration, Evidence Vault und Audit Center für eine Domain.',
    price: { monthlyEur: 0, yearlyEur: null, oneTimeEur: 349 },
    currency: 'EUR',
    purchaseMode: 'one_time',
    // `highlight` markiert genau EINEN Plan als Empfehlung im Abo-Grid
    // (das ist Growth). Ein zweiter hervorgehobener Eintrag würde die
    // Empfehlung entwerten — das Einmalprodukt trägt stattdessen das
    // Badge „Einmalig".
    highlight: false,
    badges: ['Einmalig'],
    ctaLabel: 'Jetzt buchen',
    limits: {
      bots: 1,
      answersPerMonth: 1_000,
      domains: 1,
      automationRunsPerMonth: 10,
      seats: 3,
      // Kein API-Zugriff in diesem Produkt (`permissions.api === false`).
      // Ein Limit > 0 ohne die zugehörige Berechtigung würde in der
      // Limit-Anzeige ein Kontingent versprechen, das kein Gate freigibt.
      apiCallsPerMonth: 0,
      tenants: 1,
      evidenceStorageGb: 5,
      auditReportsPerMonth: 5,
      // Ohne das Modul `remediation` gibt es keine Behebungspläne — ein
      // Kontingent hier wäre eine Anzeige ohne Funktion.
      remediationPlans: 0,
      bulkJobsPerMonth: 0,
      apiKeys: 0,
    },
    channels: ['website'],
    modules: ['dsgvo', 'policy_engine', 'evidence_vault', 'audit_center', 'compliance_reports'],
    permissions: permissions({
      evidenceVault: true,
      auditExport: true,
    }),
    support: 'email',
    addons: [],
    features: {
      audit_evidence: [
        'Evidence Vault mit 5 GB Nachweisspeicher',
        'Audit Center mit vollständigem Prüfpfad',
        'Fünf Audit-Berichte inklusive',
      ],
      ai_governance: [
        'Policy Pack DSGVO eingerichtet und aktiv',
        'Policy Engine für eigene Richtlinien',
        'Compliance Reports als PDF und JSON',
      ],
      automation_ops: [
        'Zehn Automationsläufe für die Einrichtung',
        'Ein Governance-Bot für die Website',
      ],
      multi_tenant_reseller: [],
    },
    trialDays: 0,
  },
];

// ─────────────────────────────────────────────────────────────────────────
//  Add-ons
// ─────────────────────────────────────────────────────────────────────────

export type AddOnId =
  | 'response_pack'
  | 'whatsapp'
  | 'voice'
  | 'compliance_pack'
  | 'agency_bot_pack'
  | 'white_label';

export interface AddOn {
  id: AddOnId;
  name: string;
  description: string;
  priceEur: number;
  /** Zusatz zum Preis, z.B. Minutenpreis bei Voice */
  priceNote: string;
  interval: 'month';
  bullets: string[];
  /** Pläne, für die das Add-on buchbar ist */
  availableFor: PlanId[];
}

export const ADDONS: AddOn[] = [
  {
    id: 'response_pack',
    name: 'Response Pack',
    description: 'Zusätzliche 5.000 Bot-Antworten pro Monat.',
    priceEur: 49,
    priceNote: '/ Monat',
    interval: 'month',
    bullets: [
      'Weitere 5.000 Antworten pro Monat',
      'Auf allen freigeschalteten Kanälen nutzbar',
      'Additiv zur Plan-Quote',
      'Nicht verbrauchte Antworten verfallen zum Monatsende',
    ],
    availableFor: ['growth', 'agency', 'enterprise', 'partner'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp-Business-Kanal für Ihre Governance-Bots.',
    priceEur: 99,
    priceNote: '/ Monat',
    interval: 'month',
    bullets: [
      'WhatsApp Business API Integration',
      'Nachrichten-Verifizierung und Compliance-Badges',
      'Media-Support für Bilder und Dokumente',
      'Einrichtung im Onboarding durch das Team',
    ],
    availableFor: ['growth', 'agency', 'enterprise', 'partner'],
  },
  {
    id: 'voice',
    name: 'Voice',
    description: 'Sprachkanal über Telefonie mit IVR.',
    priceEur: 150,
    priceNote: '/ Monat zzgl. 0,25 € pro Minute',
    interval: 'month',
    bullets: [
      'Eingehende und ausgehende Anrufe',
      'IVR (Interactive Voice Response)',
      'Speech-to-Text und Text-to-Speech',
      'Mehrsprachig: DE, EN, FR, ES',
    ],
    availableFor: ['agency', 'enterprise', 'partner'],
  },
  {
    id: 'compliance_pack',
    name: 'Compliance Pack',
    description: 'Erweitertes Logging, Audit-Export und Review-Workflows.',
    priceEur: 149,
    priceNote: '/ Monat',
    interval: 'month',
    bullets: [
      'DSGVO-Prüfpfad über alle Interaktionen und Entscheidungen',
      'EU-AI-Act-Risiko-Tagging automatisch je Inferenz',
      'Quartalsbericht als PDF',
      'Human-Review-Workflow für sensible Absichten',
    ],
    availableFor: ['growth', 'agency', 'enterprise', 'partner'],
  },
  {
    id: 'agency_bot_pack',
    name: 'Agency Bot Pack',
    description: 'Fünf zusätzliche Governance-Bots für Kundenprojekte.',
    priceEur: 199,
    priceNote: '/ Monat',
    interval: 'month',
    bullets: [
      'Fünf weitere produktive Governance-Bots',
      'Kundensegmentierung über die API',
      'White-Label je Bot konfigurierbar',
      'Priorisiertes Onboarding',
    ],
    availableFor: ['agency', 'enterprise', 'partner'],
  },
  {
    id: 'white_label',
    name: 'White Label',
    description: 'Vollständiges Branding mit eigener Domain.',
    priceEur: 299,
    priceNote: '/ Monat',
    interval: 'month',
    bullets: [
      'Subdomain oder eigene Domain',
      'Logo, Farben und Texte vollständig anpassbar',
      'Eigener Bot-Name und eigene Persona',
      'Analysen im eigenen Dashboard',
    ],
    availableFor: ['agency', 'enterprise', 'partner'],
  },
];

// ─────────────────────────────────────────────────────────────────────────
//  Runtime-Architektur (Darstellung auf Landing + Pricing)
// ─────────────────────────────────────────────────────────────────────────

export interface RuntimeStage {
  id: string;
  label: string;
  description: string;
  icon: string;
}

/**
 * Die kanonische Runtime-Pipeline. Diese Reihenfolge ist verbindlich und
 * wird auf Landingpage, Pricing und in der Dokumentation identisch
 * dargestellt.
 */
export const RUNTIME_PIPELINE: RuntimeStage[] = [
  { id: 'source', label: 'Website / API', description: 'Ihre Systeme, Domains und Schnittstellen als Eingang der Runtime.', icon: 'Globe' },
  { id: 'scan', label: 'Runtime Scan', description: 'Kontinuierliche Erfassung des Ist-Zustands über alle Assets.', icon: 'Radar' },
  { id: 'policy', label: 'Policy Engine', description: 'Abgleich gegen versionierte Richtlinien und Rahmenwerke.', icon: 'Scale' },
  { id: 'evidence', label: 'Evidence Vault', description: 'Manipulationssichere Ablage jedes Nachweises mit Hash-Chain.', icon: 'Archive' },
  { id: 'risk', label: 'Risk Engine', description: 'Bewertung, Priorisierung und Eintrag ins Risikoregister.', icon: 'AlertTriangle' },
  { id: 'automation', label: 'Automation', description: 'Geplante Läufe, Maßnahmen und Alarmierung ohne manuellen Anstoß.', icon: 'Cog' },
  { id: 'export', label: 'Audit Export', description: 'Prüferfertiges Nachweispaket als PDF oder JSON.', icon: 'FileOutput' },
];

// ─────────────────────────────────────────────────────────────────────────
//  Lookups und Ableitungen
// ─────────────────────────────────────────────────────────────────────────

/**
 * Die Abo-Leiter, aufsteigend nach Preis. Verbindlich für jedes Grid.
 *
 * Enthält bewusst NUR die sechs wiederkehrenden Pläne. Einmalprodukte
 * (`ONE_TIME_PLANS`) sind kein Rang der Leiter — sie werden zusätzlich
 * gekauft und dürfen die Monotonie-Invarianten nicht verwässern.
 */
export const PLAN_ORDER: PlanId[] = ['free', 'starter', 'growth', 'agency', 'enterprise', 'partner'];

/**
 * Legacy-Plan-Keys aus Bestandsdaten (DB-Zeilen, Stripe-Metadaten, alte
 * Links). Ausschließlich für die Normalisierung eingehender Daten — niemals
 * für neue Ausgaben verwenden.
 */
const LEGACY_PLAN_KEY_ALIASES: Record<string, PlanKey> = {
  scale: 'partner',
  scale_yearly: 'partner_yearly',
  free: 'free_audit',
  free_tier: 'free_audit',
  // Bindestrich-Schreibweise aus oeffentlichen URLs (/checkout/free-audit).
  // Sie steht in ausgelieferten Links und darf deshalb nicht ins Leere laufen.
  'free-audit': 'free_audit',
};

/**
 * Bildet einen beliebigen eingehenden Plan-Bezeichner auf den kanonischen
 * `PlanKey` ab. Liefert `null` für Unbekanntes — Aufrufer behandeln das
 * defensiv als „kein Plan".
 */
export function normalizePlanKey(raw: string | null | undefined): PlanKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (isPlanKey(key)) return key;
  return LEGACY_PLAN_KEY_ALIASES[key] ?? null;
}

const ALL_PLAN_KEYS: PlanKey[] = PLANS.flatMap((p) =>
  p.yearlyPlanKey ? [p.planKey, p.yearlyPlanKey] : [p.planKey],
);

export function isPlanKey(value: string): value is PlanKey {
  return (ALL_PLAN_KEYS as string[]).includes(value);
}

/**
 * Prüft gegen ALLE Plan-IDs, nicht nur gegen die Abo-Leiter `PLAN_ORDER` —
 * `governance_launch` ist eine gültige `PlanId`, steht aber nicht auf der
 * Leiter. Eine Prüfung gegen `PLAN_ORDER` würde sie fälschlich verwerfen
 * und `resolvePlan()` auf den Plan-Key-Pfad umleiten.
 */
export function isPlanId(value: string): value is PlanId {
  return PLANS.some((p) => p.id === value);
}

/** Alle gültigen Plan-Keys (monatlich + jährlich). */
export function allPlanKeys(): PlanKey[] {
  return [...ALL_PLAN_KEYS];
}

/** Plan über die Plan-ID. */
export function planById(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`[pricing] unbekannte PlanId: ${id}`);
  return plan;
}

/**
 * Plan über einen beliebigen Plan-Key — inkl. Jahresvarianten und
 * Legacy-Aliassen. Liefert `null` statt zu werfen, damit Aufrufer an
 * Systemgrenzen (DB, Stripe, URL-Parameter) defensiv bleiben können.
 */
export function planByKey(rawKey: string | null | undefined): Plan | null {
  const key = normalizePlanKey(rawKey);
  if (!key) return null;
  return PLANS.find((p) => p.planKey === key || p.yearlyPlanKey === key) ?? null;
}

/** Ist der Plan-Key eine Jahresvariante? */
export function isYearlyPlanKey(rawKey: string | null | undefined): boolean {
  const key = normalizePlanKey(rawKey);
  if (!key) return false;
  return PLANS.some((p) => p.yearlyPlanKey === key);
}

/** Abrechnungsintervall zu einem Plan-Key. */
export function intervalForPlanKey(rawKey: string | null | undefined): BillingInterval {
  const plan = planByKey(rawKey);
  if (!plan) return 'none';
  if (plan.purchaseMode === 'one_time') return 'one_time';
  if (plan.price.monthlyEur === 0) return 'none';
  return isYearlyPlanKey(rawKey) ? 'year' : 'month';
}

/**
 * Preis in Euro für einen konkreten Plan-Key (monatlich, jährlich oder
 * einmalig). Einmalprodukte führen ihren Betrag in `price.oneTimeEur` —
 * `monthlyEur` ist dort 0, weil nichts wiederkehrend abgerechnet wird.
 */
export function priceForPlanKey(rawKey: string | null | undefined): number | null {
  const plan = planByKey(rawKey);
  if (!plan) return null;
  if (plan.purchaseMode === 'one_time') return plan.price.oneTimeEur;
  return isYearlyPlanKey(rawKey) ? plan.price.yearlyEur : plan.price.monthlyEur;
}

/** Der Plan-Key zu einer Plan-ID und einem Intervall. */
export function planKeyFor(id: PlanId, interval: 'month' | 'year' = 'month'): PlanKey {
  const plan = planById(id);
  if (interval === 'year' && plan.yearlyPlanKey) return plan.yearlyPlanKey;
  return plan.planKey;
}

/** Die fünf buchbaren Abo-Pläne (ohne Free) — für Pricing-Grids. */
export const PAID_PLANS: Plan[] = PLANS.filter((p) => p.price.monthlyEur > 0);

/** Alle Abo-Pläne in verbindlicher Reihenfolge (ohne Einmalprodukte). */
export const ORDERED_PLANS: Plan[] = PLAN_ORDER.map((id) => planById(id));

/**
 * Einmalprodukte — Käufe ohne Verlängerung, die zusätzlich zu einem Abo
 * gebucht werden. Sie sind kein Rang der Abo-Leiter und deshalb nicht in
 * `PLAN_ORDER` / `ORDERED_PLANS` enthalten.
 */
export const ONE_TIME_PLANS: Plan[] = PLANS.filter((p) => p.purchaseMode === 'one_time');

/** Ist der Plan-Key ein Einmalkauf (Stripe-Modus `payment`)? */
export function isOneTimePlan(rawKey: string | null | undefined): boolean {
  return planByKey(rawKey)?.purchaseMode === 'one_time';
}

/**
 * Alle Pläne in einer stabilen Reihenfolge: erst die Abo-Leiter, dann die
 * Einmalprodukte. Basis für abgeleitete Artefakte (Plan-Katalog-SQL,
 * vollständige `Record<PlanId, …>`-Tabellen), die jeden Plan kennen müssen.
 */
export const ALL_PLANS_ORDERED: Plan[] = [...ORDERED_PLANS, ...ONE_TIME_PLANS];

/**
 * Rang eines Plans auf der Abo-Leiter (0 = free … 5 = partner).
 * `-1` für Pläne, die nicht auf der Leiter stehen (Einmalprodukte) —
 * Aufrufer müssen diesen Fall behandeln, statt mit dem Wert zu rechnen.
 */
export function planRank(id: PlanId): number {
  return PLAN_ORDER.indexOf(id);
}

/**
 * Ist `candidate` ein Upgrade gegenüber `current`?
 *
 * Einmalprodukte stehen nicht auf der Abo-Leiter und sind deshalb mit
 * keinem Abo vergleichbar — für sie ist die Antwort immer `false`. Ohne
 * diese Prüfung würde ihr Rang `-1` jedes Abo als „Upgrade" erscheinen
 * lassen und nachgelagerte `PLAN_ORDER.slice(-1, …)`-Pfade leerlaufen.
 */
export function isUpgrade(current: PlanId, candidate: PlanId): boolean {
  const currentRank = planRank(current);
  const candidateRank = planRank(candidate);
  if (currentRank < 0 || candidateRank < 0) return false;
  return candidateRank > currentRank;
}

// ── Berechtigungs-Ableitungen (nie über Plan-Namen!) ──────────────────────

export type PermissionKey = keyof PlanPermissions;

/**
 * Zentrale Berechtigungsprüfung. Der einzige zulässige Weg, im Frontend
 * oder Backend über Zugriff zu entscheiden.
 */
export function hasPermission(
  plan: Plan | PlanId | string | null | undefined,
  permission: PermissionKey,
): boolean {
  const resolved = resolvePlan(plan);
  if (!resolved) return false;
  return resolved.permissions[permission] === true;
}

/** Ist ein Modul im Plan freigeschaltet? */
export function hasModule(
  plan: Plan | PlanId | string | null | undefined,
  moduleId: ModuleId,
): boolean {
  const resolved = resolvePlan(plan);
  if (!resolved) return false;
  return resolved.modules.includes(moduleId);
}

/** Ist ein Kanal im Plan freigeschaltet? */
export function hasChannel(
  plan: Plan | PlanId | string | null | undefined,
  channel: ChannelId,
): boolean {
  const resolved = resolvePlan(plan);
  if (!resolved) return false;
  return resolved.channels.includes(channel);
}

/**
 * Limit-Abfrage. `-1` bedeutet unbegrenzt. Liefert `0` für unbekannte
 * Pläne — der defensive Default ist „nichts erlaubt".
 */
export function limitOf(
  plan: Plan | PlanId | string | null | undefined,
  limit: keyof PlanLimits,
): number {
  const resolved = resolvePlan(plan);
  if (!resolved) return 0;
  return resolved.limits[limit];
}

/** Prüft, ob ein Verbrauch noch innerhalb des Limits liegt. */
export function withinLimit(
  plan: Plan | PlanId | string | null | undefined,
  limit: keyof PlanLimits,
  current: number,
): boolean {
  const max = limitOf(plan, limit);
  if (max === -1) return true;
  return current < max;
}

/** Nimmt Plan, PlanId oder einen beliebigen Plan-Key entgegen. */
export function resolvePlan(
  plan: Plan | PlanId | string | null | undefined,
): Plan | null {
  if (!plan) return null;
  if (typeof plan === 'object') return plan;
  if (isPlanId(plan)) return planById(plan);
  return planByKey(plan);
}

/** Die im Plan aktiven Policy Packs. */
export function policyPacksFor(plan: Plan | PlanId | string | null | undefined): GovernModuleId[] {
  const resolved = resolvePlan(plan);
  if (!resolved) return [];
  return POLICY_PACK_IDS.filter((id) => resolved.modules.includes(id));
}

/** Module eines Plans, nach Produktbereich gefiltert. */
export function modulesForArea(
  plan: Plan | PlanId | string | null | undefined,
  area: ProductArea,
): ModuleDefinition[] {
  const resolved = resolvePlan(plan);
  if (!resolved) return [];
  return ALL_MODULES.filter((m) => m.area === area && resolved.modules.includes(m.id));
}

/** Modul-Definition nachschlagen. */
export function moduleById(id: ModuleId): ModuleDefinition | undefined {
  return ALL_MODULES.find((m) => m.id === id);
}

/** Der niedrigste Plan, der ein Modul enthält. */
export function minimumPlanForModule(moduleId: ModuleId): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (planById(id).modules.includes(moduleId)) return id;
  }
  return null;
}

/** Der niedrigste Plan, der eine Berechtigung gewährt. */
export function minimumPlanForPermission(permission: PermissionKey): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (planById(id).permissions[permission]) return id;
  }
  return null;
}

/** Add-ons, die für einen Plan buchbar sind. */
export function addonsFor(plan: Plan | PlanId | string | null | undefined): AddOn[] {
  const resolved = resolvePlan(plan);
  if (!resolved) return [];
  return ADDONS.filter((a) => resolved.addons.includes(a.id));
}

export function addonById(id: AddOnId): AddOn | undefined {
  return ADDONS.find((a) => a.id === id);
}

// ── Governance Score → Planempfehlung ─────────────────────────────────────

export interface PlanRecommendation {
  planId: PlanId;
  /** Warum genau dieser Plan — wird im CTA angezeigt. */
  reason: string;
}

export interface RecommendationInput {
  /** Governance Score 0–100 aus dem Free Audit. */
  score: number;
  /** Anzahl der zu überwachenden Domains/Assets. */
  domains?: number;
  /** Anzahl der Mandanten (Agentur/MSP/Reseller). */
  tenants?: number;
  /** Werden API oder Webhooks benötigt? */
  needsApi?: boolean;
  /** Wird White-Label benötigt? */
  needsWhiteLabel?: boolean;
}

/**
 * Leitet aus dem Governance Score (und optionalen Struktur-Angaben) den
 * passenden Plan ab. Bewusst deterministisch und ohne Zufall, damit die
 * Empfehlung reproduzierbar und im Prüfpfad nachvollziehbar bleibt.
 *
 * Reihenfolge der Prüfung: harte Struktur-Anforderungen schlagen den Score,
 * denn ein Reseller mit 20 Mandanten braucht Partner — unabhängig davon,
 * wie gut seine eigene Domain abschneidet.
 */
export function recommendPlan(input: RecommendationInput): PlanRecommendation {
  const { score, domains = 1, tenants = 1, needsApi = false, needsWhiteLabel = false } = input;

  if (tenants > planById('enterprise').limits.tenants) {
    return { planId: 'partner', reason: `${tenants} Mandanten erfordern die mandantengetrennte Partner-Runtime.` };
  }
  if (tenants > 1) {
    return { planId: 'enterprise', reason: `${tenants} Organisationen erfordern Multi-Tenant-Verwaltung.` };
  }
  if (needsWhiteLabel || needsApi || domains > planById('growth').limits.domains) {
    return { planId: 'agency', reason: 'API, Webhooks und White-Label sind ab Agency enthalten.' };
  }

  if (score < 40) {
    return { planId: 'growth', reason: `Governance Score ${score}/100 — kritische Lücken brauchen tägliches Monitoring und ein Risk Register.` };
  }
  if (score < 70) {
    return { planId: 'growth', reason: `Governance Score ${score}/100 — Drift Detection hält den erreichten Stand stabil.` };
  }
  return { planId: 'starter', reason: `Governance Score ${score}/100 — solide Basis, die nun lückenlos nachweisbar werden muss.` };
}

// ── Checkout-Ziele ────────────────────────────────────────────────────────

/**
 * Erzeugt das CTA-Ziel für einen Plan. Einzige Stelle, an der Checkout-
 * URLs gebildet werden — verhindert abweichende Links zwischen Landing,
 * Pricing und Dashboard.
 */
export function checkoutHrefForPlan(
  plan: Plan | PlanId,
  options: { interval?: 'month' | 'year'; source?: string } = {},
): string {
  const resolved = typeof plan === 'string' ? planById(plan) : plan;
  const { interval = 'month', source = 'pricing' } = options;
  const key = planKeyFor(resolved.id, interval);

  if (resolved.purchaseMode === 'free') {
    return `/audit?source=${encodeURIComponent(source)}`;
  }
  if (resolved.purchaseMode === 'inquiry') {
    return `/contact-sales?plan=${encodeURIComponent(key)}&source=${encodeURIComponent(source)}`;
  }
  // `checkout` und `one_time` teilen denselben Einstieg: /checkout/<planKey>.
  // Ob daraus eine Subscription oder ein Einmalkauf wird, entscheidet die
  // Edge Function `stripe-checkout` anhand von `plan.purchaseMode` — der
  // Kaufmodus darf nicht über die URL manipulierbar sein.
  const trial = resolved.trialDays > 0 ? '&pilot=true' : '';
  return `/checkout/${key}?source=${encodeURIComponent(source)}${trial}`;
}

// ── Anzeige-Formatierung ──────────────────────────────────────────────────

/**
 * Einheitliche Preisformatierung (de-DE). Wird von jeder Oberfläche
 * genutzt, damit „1.999 €" nirgendwo als „1999 €" erscheint.
 */
export function formatPriceEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Limit als Text — `-1` wird zu „unbegrenzt", `0` zu „—". */
export function formatLimit(value: number): string {
  if (value === -1) return 'unbegrenzt';
  if (value === 0) return '—';
  return new Intl.NumberFormat('de-DE').format(value);
}

/** Ersparnis der Jahresvariante in Euro. */
export function yearlySavingsEur(plan: Plan | PlanId): number {
  const resolved = typeof plan === 'string' ? planById(plan) : plan;
  if (resolved.price.yearlyEur === null) return 0;
  return resolved.price.monthlyEur * 12 - resolved.price.yearlyEur;
}

/** Positionierung — verbindlich für jeden Marketing-Text. */
export const PRODUCT_POSITIONING = 'AI Governance Runtime';

/** Vertrauenshinweis unter Pricing-Karten. */
export const PRICING_TRUST_NOTE =
  'Free Audit kostenlos · 14 Tage kostenlos testen · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany';

/** Alle Preise verstehen sich zzgl. USt. */
export const PRICING_TAX_NOTE = 'Alle Preise zzgl. gesetzlicher Umsatzsteuer.';
