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

/**
 * Wie ein Plan **vertrieben** wird — getrennt davon, wie er bezahlt wird.
 *
 * `purchaseMode` beantwortet „welche Art von Stripe-Session?", diese
 * Angabe beantwortet „darf ihn heute noch jemand neu wählen?". Beides
 * zusammenzulegen ginge schief: Ein stillgelegter Plan behält seinen
 * Kaufmodus, denn seine bestehenden Abos rechnen unverändert weiter ab.
 *
 *   `self_service` — im Preisraster sichtbar, direkt buchbar
 *   `contract`     — sichtbar, aber nur über ein Angebot erreichbar
 *   `legacy`       — nicht mehr wählbar; bestehende Abos laufen weiter
 *
 * **`legacy` löscht nichts.** Produkte, Preise, Entitlements und laufende
 * Subscriptions bleiben unangetastet — die Auflösung geht über `products`,
 * nicht über diese Angabe. Es entfällt allein das Angebot an Neukunden.
 */
export type PlanAvailability = 'self_service' | 'contract' | 'legacy';

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
  /**
   * COMMERCIAL-SSOT: temporary production hotfix.
   * Canonical source migration tracked in Phase 2.
   *
   * `true` = kein oeffentlich zugesicherter Festpreis. Der Betrag in `price`
   * bleibt interner Listenpreis (DB-Katalog, Angebotskalkulation), darf aber
   * nirgends als kaufbares Festpreis-Angebot ausgewiesen werden. Oberflaechen
   * zeigen stattdessen „Auf Anfrage".
   */
  priceOnRequest?: boolean;
  /**
   * COMMERCIAL-SSOT: temporary production hotfix.
   * Canonical source migration tracked in Phase 2.
   *
   * `true` = die Jahresvariante ist derzeit NICHT oeffentlich buchbar.
   * In `public.products` steht fuer `yearlyPlanKey` kein echter Stripe-Preis,
   * sondern ein Platzhalter (`STRIPE_PRICE_*_XXX`); `stripe-checkout` weist
   * deshalb jeden Jahres-Checkout mit `PRICE_NOT_CONFIGURED` ab.
   *
   * Der Betrag in `price.yearlyEur` bleibt interner Listenpreis — er ist
   * korrekt, nur eben nicht einloesbar — und darf nirgends als kaufbares
   * Festpreis-Angebot ausgewiesen werden. Damit gilt fuer die Jahresvariante
   * dieselbe Regel wie fuer Enterprise: ein oeffentlich zugesicherter Preis
   * darf nur dort stehen, wo der Kaufpfad ihn auch einloesen kann.
   *
   * Bestandsschutz: `yearlyPlanKey` bleibt gesetzt. Ein bestehendes
   * `_yearly`-Abo loest weiterhin ueber `planByKey()` auf seinen Basisplan
   * auf und behaelt alle Berechtigungen. Gemessen am 2026-08-31: null
   * Jahres-Abos in `public.subscriptions`.
   *
   * Stillgelegte Plaene brauchen das Feld nicht — `availability: 'legacy'`
   * schliesst sie bereits von jeder Angebotsflaeche aus. Sobald ein echter
   * Jahres-Preis verdrahtet ist, faellt dieses Feld ersatzlos weg.
   */
  yearlyCheckoutUnavailable?: boolean;
  currency: 'EUR';
  purchaseMode: PurchaseMode;
  /** Vertriebszustand — siehe `PlanAvailability`. */
  availability: PlanAvailability;
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
    technicalSubheadline: 'Unbegrenzte Runtime-Scans Ihrer Domain mit Governance Score, Top-Risiken und Planempfehlung.',
    price: { monthlyEur: 0, yearlyEur: null, oneTimeEur: null },
    currency: 'EUR',
    purchaseMode: 'free',
    availability: 'self_service',
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
    // Jahres-Preis in Stripe nicht verdrahtet — siehe `yearlyCheckoutUnavailable`.
    yearlyCheckoutUnavailable: true,
    currency: 'EUR',
    purchaseMode: 'checkout',
    availability: 'self_service',
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
      // Seit AP2 Teil von Starter: Die Feature-Liste sagte „Policy Packs:
      // DSGVO und EU AI Act" schon vorher zu, die Berechtigung fehlte.
      'policy_engine',
      'evidence_vault', 'audit_center', 'monitoring', 'compliance_reports',
      'automation_engine', 'alerts',
      'ai_bots', 'website_chat',
    ],
    permissions: permissions({
      evidenceVault: true,
      auditExport: true,
    }),
    support: 'email',
    // AP2: Starter ist der einzige Plan **ohne** WhatsApp-Kanal — und damit
    // der einzige, für den das Add-on überhaupt Sinn ergibt. Bis hierher war
    // es genau umgekehrt gebucht (zielzustand-paketmodell.md §3.2).
    // `channels` bleibt `['website']`: Der Kanal kommt mit dem Add-on, nicht
    // mit dem Plan.
    addons: ['whatsapp'],
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
    // Jahres-Preis in Stripe nicht verdrahtet — siehe `yearlyCheckoutUnavailable`.
    yearlyCheckoutUnavailable: true,
    currency: 'EUR',
    purchaseMode: 'checkout',
    availability: 'self_service',
    highlight: true,
    badges: ['Empfohlen'],
    ctaLabel: '14 Tage kostenlos testen',
    limits: {
      bots: 2,
      answersPerMonth: 2_000,
      domains: 3,
      automationRunsPerMonth: 100,
      seats: 5,
      // AP2: API, Bulk-Jobs und Schlüssel wandern von Agency nach Growth.
      // 5.000 Aufrufe sind kein neuer Wert, sondern der bereits in der
      // Datenbank hinterlegte (`limit.api_calls_monthly` auf Growth) — er
      // stand dort ohne die zugehörige Berechtigung und war damit tot.
      apiCallsPerMonth: 5_000,
      tenants: 1,
      evidenceStorageGb: 10,
      auditReportsPerMonth: 12,
      remediationPlans: 20,
      // Neu vergeben, weil es für Growth keinen Vorwert gab: bewusst
      // deutlich unter Agency (100 Bulk-Jobs, 10 Schlüssel) — Growth ist
      // ein Ein-Mandanten-Plan.
      bulkJobsPerMonth: 10,
      apiKeys: 3,
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
      // AP2 — Zielzustand §1.1: Diese Fähigkeiten lagen ausschließlich auf
      // Agency. Da Agency als Self-Service entfällt, brauchen sie ein
      // Zuhause, sonst gehen sie mit dem Plan verloren.
      api: true,
      webhooks: true,
      scheduler: true,
      bulkOperations: true,
      provenanceSigning: true,
    }),
    support: 'priority',
    // `whatsapp` entfällt hier: Growth *enthält* den Kanal bereits. Ein
    // Add-on, das verkauft, was der Plan schon hat, war der Widerspruch aus
    // `zielzustand-paketmodell.md` §3.2. Voice und White Label kommen dazu,
    // weil sie sonst mit Agency aus dem Angebot fielen.
    addons: ['response_pack', 'compliance_pack', 'voice', 'white_label', 'agency_bot_pack'],
    features: {
      audit_evidence: [
        'Alles aus Starter',
        'Evidence Vault mit Versionierung',
        'Erweiterter Evidence-Zugriff mit C2PA-Export',
        'Signierter Herkunftsnachweis (Provenance)',
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
        'API-Zugriff, Webhooks und Scheduler',
        '10 Bulk-Jobs pro Monat, 3 API-Schlüssel',
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
    availability: 'legacy',
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
    // COMMERCIAL-SSOT: temporary production hotfix.
    // Canonical source migration tracked in Phase 2.
    // Kein Trial mehr: Agency ist seit AP2 stillgelegt (`availability: 'legacy'`),
    // `stripe-checkout` weist neue Abschluesse mit PLAN_RETIRED ab. Ein
    // Trial-Versprechen waere damit nicht einloesbar — und die aus der SSoT
    // abgeleitete Trial-Fussnote fuehrte Agency bis hierher weiter mit auf.
    // Laufende Agency-Abos und -Trials sind davon unberuehrt; `trialDays`
    // steuert ausschliesslich NEUE Checkout-Sessions.
    trialDays: 0,
  },

  // ── Enterprise — Preis auf Anfrage ──────────────────────────────────────
  // COMMERCIAL-SSOT: temporary production hotfix.
  // Canonical source migration tracked in Phase 2.
  // Enterprise wird manuell fakturiert (products.default_for_plan_key='enterprise'
  // traegt bewusst nur einen Sentinel, keine echte Stripe-Price). Ein oeffentlich
  // zugesicherter Festpreis von 1.249 € war damit ein Angebot, das der
  // Self-Service-Checkout nicht erfuellen kann. Deshalb: inquiry + priceOnRequest.
  {
    id: 'enterprise',
    planKey: 'enterprise',
    yearlyPlanKey: 'enterprise_yearly',
    name: 'Enterprise',
    outcomeHeadline: 'Konzernweite Governance über alle sechs Rahmenwerke — mit SLA und SSO.',
    technicalSubheadline: 'Multi-Tenant-Runtime für bis zu 5 Organisationen, zentrale Rechteverwaltung und individuell dimensionierte Scheduler- und Automation-Kontingente.',
    price: { monthlyEur: 1_249, yearlyEur: 12_490, oneTimeEur: null },
    priceOnRequest: true,
    currency: 'EUR',
    purchaseMode: 'inquiry',
    availability: 'contract',
    highlight: false,
    badges: ['SLA nach Vereinbarung'],
    ctaLabel: 'Enterprise anfragen',
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
    // `whatsapp` entfällt wie bei Growth: Der Kanal ist im Plan enthalten
    // (`channels`), ein Add-on darauf verkaufte Vorhandenes.
    addons: ['response_pack', 'voice', 'compliance_pack', 'agency_bot_pack', 'white_label'],
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
        'Individuell dimensionierte Scheduler- und Automation-Kontingente.',
        'API Premium mit 250.000 Aufrufen pro Monat',
        '20 Governance-Bots mit 50.000 Antworten (alle Kanäle)',
        'Priorisierter Support mit vertraglich vereinbarter Reaktionszeit',
      ],
      multi_tenant_reseller: [
        'Multi-Tenant-Dashboard für bis zu 5 Organisationen',
        'Zentrale Benutzerverwaltung mit Rollen und Rechten',
        'Single Sign-On',
        'White-Label mit Branding, Logo und Farben',
      ],
    },
    // Enterprise-Trial ist gesperrt: kein Self-Service-Pilot ohne Vertrag.
    trialDays: 0,
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
    availability: 'legacy',
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
    availability: 'self_service',
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
  /**
   * Pläne, für die das Add-on **angeboten** wird.
   *
   * Seit AP2 nennt diese Liste ausschließlich Pläne, die noch verkauft
   * werden. Was ein bestehender Kunde tatsächlich buchen darf, entscheidet
   * weiterhin `plan.addons` — und die Add-on-Listen der stillgelegten Pläne
   * Agency und Partner sind absichtlich unverändert geblieben. Ein
   * Bestandskunde verliert dadurch kein Add-on; es wird nur keinem
   * Neukunden mehr auf einem Plan angeboten, den er gar nicht wählen kann.
   */
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
    availableFor: ['growth', 'enterprise'],
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
    // AP2 — die Korrektur aus `zielzustand-paketmodell.md` §3.2: Das Add-on
    // war ausgerechnet für den einzigen Plan *ohne* WhatsApp nicht buchbar
    // und wurde denen angeboten, die den Kanal bereits enthalten. Genau
    // verkehrt herum. Ab Growth ist WhatsApp Teil des Plans.
    availableFor: ['starter'],
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
    availableFor: ['growth', 'enterprise'],
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
    availableFor: ['growth', 'enterprise'],
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
    availableFor: ['growth', 'enterprise'],
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
    availableFor: ['growth', 'enterprise'],
  },
];

// ─────────────────────────────────────────────────────────────────────────
//  Buchbare Module (modulare Product Experience)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Der Produktpfad, den ein Kunde nach dem kostenlosen Scan wählt.
 *
 * Der entscheidende Produktgrundsatz: **Compliance ist das Fundament,
 * das Frontend ist optional.** Niemand darf gezwungen werden, seine
 * bestehende Website umzubauen, um Governance nutzen zu können — und
 * niemand verliert Governance, weil er beim alten Frontend bleibt.
 *
 * Deshalb sind das zwei getrennte Entscheidungen und kein Auf-/Abstieg:
 *  - `keep_frontend`      — bestehendes Frontend bleibt unangetastet,
 *                           RealSync liefert nur die Governance-Schicht
 *                           (Scan, API, SDK, Snippet, Runtime-Anbindung).
 *  - `modernize_frontend` — zusätzlich wird über SiteOS ein neues Frontend
 *                           aus den vorhandenen Inhalten erzeugt.
 *
 * `modernize_frontend` ist eine **Ergänzung** von `keep_frontend`, kein
 * Ersatz: der Governance-Umfang ist in beiden Pfaden identisch. Der Pfad
 * ist jederzeit wechselbar und darf nirgendwo als Berechtigung dienen —
 * dafür gibt es `hasModule()` / `hasPermission()`.
 */
export type ProductTrack = 'keep_frontend' | 'modernize_frontend';

export const PRODUCT_TRACKS: ProductTrack[] = ['keep_frontend', 'modernize_frontend'];

export function isProductTrack(value: string | null | undefined): value is ProductTrack {
  return value === 'keep_frontend' || value === 'modernize_frontend';
}

/**
 * Ein einzeln buchbares, kostenpflichtiges Modul.
 *
 * Abgrenzung zu den beiden benachbarten Begriffen in dieser Datei — die
 * drei sind bewusst verschieden und dürfen nicht vermischt werden:
 *
 *  - `ModuleDefinition` (`ModuleId`) beschreibt eine **Fähigkeit** der
 *    Runtime. Sie hat keinen Preis; ein Plan schaltet sie über
 *    `plan.modules` frei.
 *  - `AddOn` (`AddOnId`) ist ein **Zusatz zu einem bestehenden Abo** und
 *    an `availableFor`-Pläne gebunden.
 *  - `BookableModule` (hier) ist die **Verkaufseinheit des modularen
 *    Checkouts**: Governance Core als Fundament, alles Weitere einzeln
 *    zubuchbar, unabhängig von der Plan-Leiter.
 *
 * Ein Modul schaltet über `unlocks` die Fähigkeiten frei, die es abdeckt.
 * Die Berechtigungsprüfung im Produkt bleibt damit `hasModule()` — der
 * Kaufweg ändert nichts an der Art, wie Zugriff entschieden wird.
 */
export type BookableModuleId =
  | 'governance_core'
  | 'ai_frontend'
  | 'website_chat'
  | 'voice_bot'
  | 'whatsapp_bot'
  | 'booking'
  | 'advanced_ai_governance'
  | 'additional_domain'
  | 'additional_company';

/**
 * `flat`            — fester Monatspreis, keine nutzungsabhängigen Kosten.
 * `flat_plus_usage` — fester Monatspreis **plus** verbrauchsabhängige
 *                     Abrechnung. Pflicht überall dort, wo echte
 *                     Drittkosten je Nutzung anfallen (Telefonie, STT/TTS,
 *                     WhatsApp-Konversationen). Ohne diese Kennzeichnung
 *                     verkauft ein intensiver Kunde die Marge auf.
 * `per_unit`        — Preis je zusätzlicher Einheit (Domain, Unternehmen).
 */
export type ModulePriceModel = 'flat' | 'flat_plus_usage' | 'per_unit';

export interface BookableModule {
  id: BookableModuleId;
  name: string;
  description: string;
  /**
   * ⚠️ PROVISORISCH — siehe `MODULE_PRICING_STATUS`. Diese Beträge sind
   * Testwerte für den Aufbau des Checkouts, keine kalkulierten Preise.
   */
  priceEur: number;
  priceModel: ModulePriceModel;
  /** Zusatz zum Preis, z.B. Minutenpreis. `null` bei reinem Festpreis. */
  usageNote: string | null;
  /** Fundament — kann im Checkout nicht abgewählt werden. */
  required: boolean;
  /**
   * `true`, wenn das Modul das von RealSync erzeugte Frontend voraussetzt.
   *
   * Steht bewusst bei **keinem** Modul auf `true` außer `ai_frontend`
   * selbst: Chat, Voice, WhatsApp und Terminbuchung funktionieren auch
   * auf einer fremden Website — über Snippet, SDK oder API. Wer das
   * ändert, hebelt den Produktgrundsatz aus.
   */
  requiresFrontend: boolean;
  /**
   * Entitlement-Keys, die dieses Modul freischaltet.
   *
   * Vorher `ModuleId[]`. Seit AP1 ist der Entitlement-Key der einzige
   * Namensraum: `plan.modules` und die Datenbank gingen auseinander, und
   * maßgeblich ist die Datenbank, weil sie zur Laufzeit autorisiert.
   */
  unlocks: EntitlementKey[];
  /** Lucide-Icon-Name — einheitliches Icon-Set über alle Oberflächen. */
  icon: string;
  bullets: string[];
}

/**
 * Statuskennzeichnung der Modulpreise.
 *
 * Die Beträge in `BOOKABLE_MODULES` sind bewusst **nicht** festgezurrt.
 * Sie müssen aus den tatsächlichen Infrastrukturkosten rückwärts
 * kalkuliert werden — insbesondere Voice (Telefonie + STT/TTS), LLM-Token,
 * WhatsApp-Konversationsgebühren, Scan-Laufzeit und zusätzliche Domains.
 * Bis dahin gilt: Struktur ist verbindlich, Betrag ist ein Testwert.
 */
export const MODULE_PRICING_STATUS = 'provisional' as const;

/**
 * Warum die Beträge hier von `ADDONS` abweichen dürfen.
 *
 * `ADDONS` bepreist Zusätze **innerhalb** der Plan-Leiter (Voice 150 €,
 * WhatsApp 99 €) und bleibt unverändert gültig. `BOOKABLE_MODULES`
 * bepreist dieselben Kanäle als **eigenständige Verkaufseinheit** neben
 * dem Governance Core. Zwei Preise für denselben Kanal sind auf Dauer
 * kein haltbarer Zustand — die Auflösung gehört in die Preiskalkulation,
 * nicht in eine stillschweigende Angleichung hier. Bis dahin wird die
 * Abweichung benannt statt versteckt.
 *
 * **WhatsApp ist seit AP2 aufgelöst** (99 € an beiden Stellen) und steht
 * deshalb nicht mehr hier. Voice bleibt offen: 99 € als Modul gegen 150 €
 * als Add-on. Das ist keine Nachlässigkeit, sondern der Rest einer
 * Kalkulation, die für Telefonie noch aussteht — Minutenpreise und
 * STT/TTS-Kosten sind nicht gemessen. Wer sie angleicht, ohne gerechnet zu
 * haben, ersetzt eine benannte Abweichung durch eine verdeckte.
 */
export const MODULE_ADDON_PRICE_DIVERGENCE: BookableModuleId[] = ['voice_bot'];

export const BOOKABLE_MODULES: BookableModule[] = [
  {
    id: 'governance_core',
    name: 'Governance Core',
    description: 'Kontinuierliche DSGVO- und EU-AI-Act-Governance für ein Unternehmen und eine Domain.',
    priceEur: 79,
    priceModel: 'flat',
    usageNote: null,
    required: true,
    requiresFrontend: false,
    unlocks: ['governance.dsgvo_directory', 'governance.ai_register', 'policy.packs', 'evidence.basic_vault', 'website.scan', 'monitoring.monthly', 'compliance.export', 'alerts.email'],
    icon: 'Shield',
    bullets: [
      'Ein Unternehmen, eine Domain',
      'DSGVO und EU AI Act als Policy Packs',
      'Kontinuierliches Monitoring statt Einmalprüfung',
      'Governance Score, Evidence Vault und Audit-Export',
      'Alerts bei neuen Findings',
    ],
  },
  {
    id: 'ai_frontend',
    name: 'AI Frontend',
    description: 'Erzeugt aus der bestehenden Website ein modernes Frontend — ohne die vorhandenen Inhalte zu verlieren.',
    priceEur: 49,
    priceModel: 'flat',
    usageNote: null,
    required: false,
    requiresFrontend: true,
    unlocks: [],
    icon: 'LayoutTemplate',
    bullets: [
      'Inhalts-Inventar der bestehenden Seite statt Neutexten',
      'Vorschau und ausdrückliche Freigabe vor dem Publish',
      'Jederzeit zurück auf das Original umschaltbar',
      'Responsive, barrierearm, SEO-erhaltend',
    ],
  },
  {
    id: 'website_chat',
    name: 'Website Chat',
    description: 'Eingebetteter Chatbot auf der eigenen Website — auch auf einem fremden Frontend.',
    priceEur: 39,
    priceModel: 'flat_plus_usage',
    usageNote: 'zzgl. Verbrauch je Konversation',
    required: false,
    requiresFrontend: false,
    unlocks: ['bots.chat', 'bots.enabled'],
    icon: 'MessageSquare',
    bullets: [
      'Snippet-Einbindung ohne Frontend-Umbau',
      'Antwortet nur aus dem hinterlegten Unternehmenskontext',
      'Transparenzhinweis nach Art. 50 EU AI Act',
      'Jede Antwort im Prüfpfad',
    ],
  },
  {
    id: 'voice_bot',
    name: 'Voice Bot',
    description: 'Telefonischer Sprachkanal mit derselben Buchungs- und Kontext-Engine wie der Website-Chat.',
    priceEur: 99,
    priceModel: 'flat_plus_usage',
    usageNote: 'zzgl. Telefonie- und Sprachverbrauch je Minute',
    required: false,
    requiresFrontend: false,
    unlocks: ['bots.voice', 'bots.enabled', 'bots.human_handoff'],
    icon: 'Phone',
    bullets: [
      'Eingehende Anrufe mit Speech-to-Text und Text-to-Speech',
      'Übergabe an Menschen mit Eskalationsstufen',
      'Keine eigene Terminlogik — fragt die Booking Engine',
      'Verbrauchsabhängig, weil echte Telefoniekosten anfallen',
    ],
  },
  {
    id: 'whatsapp_bot',
    name: 'WhatsApp Bot',
    description: 'WhatsApp-Business-Kanal mit identischem Governance-Protokoll.',
    // AP2 — Entscheidung des Eigentümers vom 2026-08-24: ein Preis für den
    // WhatsApp-Kanal, und zwar der aus `ADDONS` (99 €). Er stand an drei
    // übereinstimmenden Stellen — Datenbank, Preisseite, `ADDONS` — gegen
    // die 39 € an einer. Die 39 € gehörten zum rein modularen Modell, das
    // mit der Dreier-Leiter entfällt.
    //
    // Die Kachel selbst bleibt: WhatsApp ist weiterhin buchbar, und ein
    // Dienst, den man kaufen kann, gehört in den Marketplace
    // (`CLAUDE.md` §14). Entfallen ist der zweite Preis, nicht der Kanal.
    priceEur: 99,
    priceModel: 'flat_plus_usage',
    usageNote: 'zzgl. WhatsApp-Konversationsgebühren',
    required: false,
    requiresFrontend: false,
    unlocks: ['bots.whatsapp', 'bots.enabled', 'bots.multi_channel'],
    icon: 'MessageCircle',
    bullets: [
      'WhatsApp Business API',
      'Ein Bot, mehrere Kanäle, ein Prüfpfad',
      'Media-Support für Bilder und Dokumente',
      'Konversationsgebühren werden durchgereicht',
    ],
  },
  {
    id: 'booking',
    name: 'Terminbuchung',
    description: 'Booking Engine mit Öffnungszeiten, Pausen, Urlaub und variablen Termindauern.',
    priceEur: 29,
    priceModel: 'flat',
    usageNote: null,
    required: false,
    requiresFrontend: false,
    unlocks: ['bots.appointments'],
    icon: 'CalendarClock',
    bullets: [
      'Zentrale Slot-Berechnung für alle Kanäle',
      'Variable Termindauer je Zeitfenster',
      'Urlaub, Feiertage und Pausen blockieren sofort',
      'Bots erfinden keine Termine — sie fragen die Engine',
    ],
  },
  {
    id: 'advanced_ai_governance',
    name: 'Advanced AI Governance',
    description: 'Erweiterte Rahmenwerke, Risikoregister und Behebungspläne über den Core hinaus.',
    priceEur: 149,
    priceModel: 'flat',
    usageNote: null,
    required: false,
    requiresFrontend: false,
    unlocks: ['policy.nis2', 'policy.iso27001', 'governance.risk_register', 'fix.snippets', 'monitoring.drift'],
    icon: 'Brain',
    bullets: [
      'NIS2 und ISO 27001 zusätzlich zu DSGVO und EU AI Act',
      'Risikoregister mit Eigentümern und Maßnahmenverfolgung',
      'Drift-Erkennung zwischen zwei Läufen',
      'Vorbereitete Behebungspläne mit Review-Pflicht',
    ],
  },
  {
    id: 'additional_domain',
    name: 'Weitere Domain',
    description: 'Jede weitere überwachte Domain innerhalb desselben Unternehmens.',
    priceEur: 19,
    priceModel: 'per_unit',
    usageNote: 'je Domain und Monat',
    required: false,
    requiresFrontend: false,
    unlocks: [],
    icon: 'Globe',
    bullets: [
      'Eigener Governance Score je Domain',
      'Gemeinsames Evidence Vault des Unternehmens',
      'Beliebig oft buchbar',
    ],
  },
  {
    id: 'additional_company',
    name: 'Weiteres Unternehmen',
    description: 'Ein weiteres Unternehmen im selben Konto — datentechnisch getrennt.',
    priceEur: 49,
    priceModel: 'per_unit',
    usageNote: 'je Unternehmen und Monat',
    required: false,
    requiresFrontend: false,
    unlocks: ['bots.multi_channel'],
    icon: 'Building2',
    bullets: [
      'Eigene Domains, Bots und Governance je Unternehmen',
      'Umschalten im Dashboard',
      'Mandantentrennung über RLS, nicht über die Oberfläche',
    ],
  },
];

/** Das Fundament, das in jedem Checkout enthalten ist. */
export const REQUIRED_MODULES: BookableModule[] = BOOKABLE_MODULES.filter((m) => m.required);

/** Alles, was der Kunde frei dazu- oder abwählen kann. */
export const OPTIONAL_MODULES: BookableModule[] = BOOKABLE_MODULES.filter((m) => !m.required);

export function bookableModuleById(id: BookableModuleId): BookableModule | undefined {
  return BOOKABLE_MODULES.find((m) => m.id === id);
}

/**
 * Module, die im gewählten Produktpfad überhaupt angeboten werden.
 *
 * Im Pfad `keep_frontend` entfällt genau ein Modul: `ai_frontend`. Alles
 * andere bleibt buchbar — das ist der Punkt.
 */
export function modulesForTrack(track: ProductTrack): BookableModule[] {
  if (track === 'modernize_frontend') return BOOKABLE_MODULES;
  return BOOKABLE_MODULES.filter((m) => !m.requiresFrontend);
}

/**
 * Monatlicher Festpreis der Auswahl. Der Core wird immer mitgerechnet,
 * auch wenn er in der Auswahl fehlt — er ist nicht abwählbar.
 *
 * Verbrauchsabhängige Anteile (`flat_plus_usage`) sind bewusst **nicht**
 * enthalten: sie stehen zum Zeitpunkt des Checkouts nicht fest. Wer eine
 * Gesamtsumme anzeigt, muss `hasUsageBasedModules()` mitprüfen und den
 * Verbrauch getrennt ausweisen — sonst verspricht die Oberfläche einen
 * Endbetrag, den die Rechnung nicht hält.
 */
export function monthlyBaseTotalEur(selection: readonly BookableModuleId[]): number {
  const ids = new Set<BookableModuleId>(selection);
  for (const module of REQUIRED_MODULES) ids.add(module.id);
  let total = 0;
  for (const id of ids) total += bookableModuleById(id)?.priceEur ?? 0;
  return total;
}

/** Enthält die Auswahl mindestens ein verbrauchsabhängiges Modul? */
export function hasUsageBasedModules(selection: readonly BookableModuleId[]): boolean {
  const ids = new Set<BookableModuleId>(selection);
  for (const module of REQUIRED_MODULES) ids.add(module.id);
  for (const id of ids) {
    if (bookableModuleById(id)?.priceModel === 'flat_plus_usage') return true;
  }
  return false;
}

/**
 * Normalisiert eine Auswahl: unbekannte IDs fallen weg, Pflichtmodule
 * kommen hinzu, die Reihenfolge folgt `BOOKABLE_MODULES`.
 *
 * Nötig, weil die Auswahl aus einer URL oder aus `sessionStorage` kommen
 * kann — beides ist Nutzereingabe und darf nicht ungeprüft in den
 * Checkout laufen.
 */
export function normalizeModuleSelection(raw: readonly string[]): BookableModuleId[] {
  const wanted = new Set(raw);
  return BOOKABLE_MODULES.filter((m) => m.required || wanted.has(m.id)).map((m) => m.id);
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   Kanonisches Entitlement-Vokabular (AP1)
   ═══════════════════════════════════════════════════════════════════════════

   **Ein** Namensraum für die Frage „Was darf dieser Kunde?".

       Paket ┐
       Add-on┼──→  Entitlement-Key  ──→  Runtime-Autorisierung  ──→  Oberfläche
       Grant ┘

   Vorher standen drei Vokabulare nebeneinander: `ModuleId` (in `unlocks` und
   `plan.modules`), `addon_id` und die Entitlement-Keys der Datenbank. Jedes
   neue Modul musste an drei Stellen gepflegt werden, und keine der drei war
   maßgeblich — autorisiert wurde über die Datenbank, angezeigt über die
   Module.

   ## Was hier maßgeblich ist

   Diese Zuordnung spiegelt den Stand **nach allen Migrationen**, gemessen
   gegen eine lokale PostgreSQL mit dem vollständigen Migrationslauf — nicht
   den Live-Stand und nicht `plan.modules`. Wo beide auseinandergingen, gilt
   die Datenbank: Sie ist es, die zur Laufzeit autorisiert.

   ## Was ausdrücklich bleibt

   `plan.modules` und `plan.permissions` bleiben unangetastet. Sie tragen die
   Feature-Listen der Preisseite und speisen über
   `src/core/billing/entitlements.ts` das Verbrauchsmodell. `FEATURE_RULES`
   dort ist **kein** Freischaltungs-Vokabular und darf nicht in dieses System
   gezogen werden — es beantwortet Kontingentfragen, nicht Zugriffsfragen.

   ## Regel

   Ein neues Modul bekommt einen Key hier und eine Zeile in der Migration.
   Kein vierter Namensraum, keine Übersetzungstabelle.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Vollständiges Vokabular. Alphabetisch, damit Diffs klein bleiben. */
export const ENTITLEMENT_KEYS = [
  'ai.tool.automations',
  'ai.tool.bot_reply',
  'ai.tool.code_explain',
  'ai.tool.log_analyze',
  'ai.tool.vps_action_advisor',
  'ai.tool.vps_status',
  'ai.tool.workflows',
  'ai_classification.limited',
  'alerts.email',
  'api.access',
  'asset.register',
  'asset.verify',
  'barcode.issue',
  'bots.appointments',
  'bots.chat',
  'bots.count',
  'bots.enabled',
  'bots.human_handoff',
  'bots.multi_channel',
  'bots.orders',
  'bots.voice',
  'bots.whatsapp',
  'bulk.jobs',
  'c2pa.export',
  'compliance.export',
  'dashboard.access',
  'dse.generator',
  'evidence.advanced',
  'evidence.basic_vault',
  'fix.snippets',
  'governance.ai_register',
  'governance.dsgvo_directory',
  'governance.risk_register',
  'limit.active_assets',
  'limit.agent_runs_monthly',
  'limit.ai_calls_monthly',
  'limit.ai_cost_monthly_cents',
  'limit.ai_tokens_monthly',
  'limit.api_calls_monthly',
  'limit.automation_runs_monthly',
  'limit.bot_messages_monthly',
  'limit.bot_voice_minutes_monthly',
  'limit.bots',
  'limit.bulk_jobs_monthly',
  'limit.compliance_exports_monthly',
  'limit.domains',
  'limit.evidence_storage_gb',
  'limit.llm_queries_monthly',
  'limit.monthly_registrations',
  'limit.team_seats',
  'limit.whatsapp_conversations_monthly',
  'limit.workflow_runs_monthly',
  'monitoring.daily',
  'monitoring.drift',
  'monitoring.monthly',
  'org.governance',
  'policy.iso27001',
  'policy.nis2',
  'policy.packs',
  'provenance.advanced',
  'provenance.basic',
  'public-sector.mode',
  'reports.export',
  'scheduler.enabled',
  'sla.priority',
  'sso.enabled',
  'team.members',
  'watermark.apply',
  'webhooks.enabled',
  'website.scan',
  'website.scan_monthly_limit',
  'whitelabel.dashboard',
  'whitelabel.reports',
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

/**
 * Was jeder Plan gewährt, je Key mit seinem Wert.
 *
 * `1` = an (boolesch) · `0` = aus · `-1` = unbegrenzt · sonst das Kontingent.
 * Schlüssel ist der `planKey`, nicht die `PlanId` — dieselbe Kennung wie in
 * `products.default_for_plan_key` und `subscriptions.plan_key`.
 *
 * Erzeugt aus dem gemessenen Migrationsstand, nicht abgetippt.
 * `test/billing/entitlement-vocabulary.test.ts` hält die Zuordnung an die
 * Migrationen gebunden.
 */
export const PLAN_ENTITLEMENTS: Readonly<
  Record<string, Readonly<Partial<Record<EntitlementKey, number>>>>
> = {
  free_audit: {
    'ai_classification.limited': 0,
    'bots.count': 0,
    'dashboard.access': 1,
    'evidence.basic_vault': 1,
    'governance.ai_register': 1,
    'governance.dsgvo_directory': 1,
    'reports.export': 0,
    'website.scan': 1,
    'website.scan_monthly_limit': -1,
  },
  starter: {
    'ai.tool.automations': 1,
    'alerts.email': 1,
    'asset.verify': 1,
    'bots.chat': 1,
    'bots.enabled': 1,
    'compliance.export': 1,
    'dashboard.access': 1,
    'dse.generator': 1,
    'evidence.basic_vault': 1,
    'governance.ai_register': 1,
    'governance.dsgvo_directory': 1,
    'limit.agent_runs_monthly': 100,
    'limit.automation_runs_monthly': 25,
    'limit.bot_messages_monthly': 500,
    'limit.bots': 1,
    'limit.compliance_exports_monthly': 5,
    'limit.domains': 1,
    'limit.llm_queries_monthly': 100,
    'limit.team_seats': 3,
    'monitoring.monthly': 1,
    'policy.packs': 1,
    'website.scan': 1,
    'website.scan_monthly_limit': -1,
  },
  growth: {
    'ai.tool.automations': 1,
    'ai.tool.bot_reply': 1,
    'alerts.email': 1,
    'api.access': 1,
    'asset.register': 1,
    'asset.verify': 1,
    'bots.appointments': 1,
    'bots.chat': 1,
    'bots.enabled': 1,
    'bots.multi_channel': 1,
    'bots.orders': 1,
    'bots.whatsapp': 1,
    'bulk.jobs': 1,
    'c2pa.export': 1,
    'compliance.export': 1,
    'dashboard.access': 1,
    'dse.generator': 1,
    'evidence.advanced': 1,
    'evidence.basic_vault': 1,
    'fix.snippets': 1,
    'governance.ai_register': 1,
    'governance.dsgvo_directory': 1,
    'governance.risk_register': 1,
    'limit.ai_calls_monthly': 2000,
    'limit.ai_cost_monthly_cents': 2000,
    'limit.ai_tokens_monthly': 2000000,
    'limit.api_calls_monthly': 5000,
    'limit.automation_runs_monthly': 100,
    'limit.bot_messages_monthly': 2000,
    'limit.bots': 2,
    'limit.bulk_jobs_monthly': 10,
    'limit.compliance_exports_monthly': 20,
    'limit.domains': 3,
    'limit.llm_queries_monthly': 500,
    'limit.team_seats': 5,
    'limit.whatsapp_conversations_monthly': 500,
    'monitoring.daily': 1,
    'monitoring.drift': 1,
    'monitoring.monthly': 1,
    'policy.iso27001': 1,
    'policy.packs': 1,
    'provenance.advanced': 1,
    'scheduler.enabled': 1,
    'team.members': 1,
    'webhooks.enabled': 1,
    'website.scan': 1,
    'website.scan_monthly_limit': -1,
  },
  agency: {
    'ai.tool.automations': 1,
    'ai.tool.bot_reply': 1,
    'ai.tool.vps_action_advisor': 1,
    'ai.tool.vps_status': 1,
    'alerts.email': 1,
    'api.access': 1,
    'asset.register': 1,
    'asset.verify': 1,
    'bots.appointments': 1,
    'bots.chat': 1,
    'bots.enabled': 1,
    'bots.human_handoff': 1,
    'bots.multi_channel': 1,
    'bots.orders': 1,
    'bots.voice': 1,
    'bots.whatsapp': 1,
    'bulk.jobs': 1,
    'c2pa.export': 1,
    'compliance.export': 1,
    'dashboard.access': 1,
    'dse.generator': 1,
    'evidence.advanced': 1,
    'evidence.basic_vault': 1,
    'fix.snippets': 1,
    'governance.ai_register': 1,
    'governance.dsgvo_directory': 1,
    'governance.risk_register': 1,
    'limit.ai_calls_monthly': 10000,
    'limit.ai_cost_monthly_cents': 10000,
    'limit.ai_tokens_monthly': 10000000,
    'limit.api_calls_monthly': 25000,
    'limit.automation_runs_monthly': 500,
    'limit.bot_messages_monthly': 10000,
    'limit.bot_voice_minutes_monthly': 500,
    'limit.bots': 10,
    'limit.bulk_jobs_monthly': 50,
    'limit.compliance_exports_monthly': 100,
    'limit.domains': 10,
    'limit.llm_queries_monthly': -1,
    'limit.team_seats': 15,
    'limit.whatsapp_conversations_monthly': 2500,
    'monitoring.daily': 1,
    'monitoring.drift': 1,
    'monitoring.monthly': 1,
    'policy.iso27001': 1,
    'policy.nis2': 1,
    'policy.packs': 1,
    'provenance.advanced': 1,
    'scheduler.enabled': 1,
    'sla.priority': 1,
    'team.members': 1,
    'webhooks.enabled': 1,
    'website.scan': 1,
    'website.scan_monthly_limit': -1,
    'whitelabel.reports': 1,
  },
  enterprise: {
    'ai.tool.automations': 1,
    'ai.tool.bot_reply': 1,
    'ai.tool.vps_action_advisor': 1,
    'ai.tool.vps_status': 1,
    'alerts.email': 1,
    'api.access': 1,
    'asset.register': 1,
    'asset.verify': 1,
    'bots.appointments': 1,
    'bots.chat': 1,
    'bots.enabled': 1,
    'bots.human_handoff': 1,
    'bots.multi_channel': 1,
    'bots.orders': 1,
    'bots.voice': 1,
    'bots.whatsapp': 1,
    'bulk.jobs': 1,
    'c2pa.export': 1,
    'compliance.export': 1,
    'dashboard.access': 1,
    'dse.generator': 1,
    'evidence.advanced': 1,
    'evidence.basic_vault': 1,
    'fix.snippets': 1,
    'governance.ai_register': 1,
    'governance.dsgvo_directory': 1,
    'governance.risk_register': 1,
    'limit.agent_runs_monthly': -1,
    'limit.ai_calls_monthly': -1,
    'limit.ai_cost_monthly_cents': -1,
    'limit.ai_tokens_monthly': -1,
    'limit.api_calls_monthly': -1,
    'limit.automation_runs_monthly': -1,
    'limit.bot_messages_monthly': -1,
    'limit.bot_voice_minutes_monthly': -1,
    'limit.bots': -1,
    'limit.bulk_jobs_monthly': -1,
    'limit.compliance_exports_monthly': -1,
    'limit.domains': -1,
    'limit.llm_queries_monthly': -1,
    'limit.team_seats': -1,
    'limit.whatsapp_conversations_monthly': -1,
    'monitoring.daily': 1,
    'monitoring.drift': 1,
    'monitoring.monthly': 1,
    'org.governance': 1,
    'policy.iso27001': 1,
    'policy.nis2': 1,
    'policy.packs': 1,
    'provenance.advanced': 1,
    'scheduler.enabled': 1,
    'sla.priority': 1,
    'sso.enabled': 1,
    'team.members': 1,
    'webhooks.enabled': 1,
    'website.scan': 1,
    'website.scan_monthly_limit': -1,
    'whitelabel.dashboard': 1,
    'whitelabel.reports': 1,
  },
  partner: {
    'ai.tool.automations': 1,
    'ai.tool.bot_reply': 1,
    'ai.tool.vps_action_advisor': 1,
    'ai.tool.vps_status': 1,
    'alerts.email': 1,
    'api.access': 1,
    'asset.register': 1,
    'asset.verify': 1,
    'bots.appointments': 1,
    'bots.chat': 1,
    'bots.enabled': 1,
    'bots.human_handoff': 1,
    'bots.multi_channel': 1,
    'bots.orders': 1,
    'bots.voice': 1,
    'bots.whatsapp': 1,
    'bulk.jobs': 1,
    'c2pa.export': 1,
    'compliance.export': 1,
    'dashboard.access': 1,
    'dse.generator': 1,
    'evidence.advanced': 1,
    'evidence.basic_vault': 1,
    'fix.snippets': 1,
    'governance.ai_register': 1,
    'governance.dsgvo_directory': 1,
    'governance.risk_register': 1,
    'limit.ai_calls_monthly': 50000,
    'limit.ai_cost_monthly_cents': 50000,
    'limit.ai_tokens_monthly': 50000000,
    'limit.api_calls_monthly': 100000,
    'limit.automation_runs_monthly': 2500,
    'limit.bot_messages_monthly': 50000,
    'limit.bot_voice_minutes_monthly': 2500,
    'limit.bots': 50,
    'limit.bulk_jobs_monthly': 500,
    'limit.compliance_exports_monthly': 500,
    'limit.domains': 50,
    'limit.llm_queries_monthly': -1,
    'limit.team_seats': 50,
    'limit.whatsapp_conversations_monthly': -1,
    'monitoring.daily': 1,
    'monitoring.drift': 1,
    'monitoring.monthly': 1,
    'org.governance': 1,
    'policy.iso27001': 1,
    'policy.nis2': 1,
    'policy.packs': 1,
    'provenance.advanced': 1,
    'scheduler.enabled': 1,
    'sla.priority': 1,
    'team.members': 1,
    'webhooks.enabled': 1,
    'website.scan': 1,
    'website.scan_monthly_limit': -1,
    'whitelabel.dashboard': 1,
    'whitelabel.reports': 1,
  },
  governance_launch: {
    'bots.enabled': 1,
    'compliance.export': 1,
    'dashboard.access': 1,
    'dse.generator': 1,
    'evidence.basic_vault': 1,
    'governance.dsgvo_directory': 1,
    'limit.automation_runs_monthly': 10,
    'limit.bot_messages_monthly': 1000,
    'limit.bots': 1,
    'limit.compliance_exports_monthly': 5,
    'limit.domains': 1,
    'limit.evidence_storage_gb': 5,
    'limit.team_seats': 3,
    'policy.packs': 1,
    'reports.export': 1,
    'website.scan': 1,
  },
};

/**
 * Wert eines Keys in einem Plan. `null` heißt: der Plan kennt ihn nicht.
 *
 * Bewusst `null` statt `0`: „nicht enthalten" und „enthalten, aber auf null
 * gesetzt" sind verschiedene Aussagen. `free_tier` führt etwa
 * `reports.export` ausdrücklich mit `0`.
 */
export function planEntitlementValue(
  planKeyOrId: string | null | undefined,
  key: EntitlementKey,
): number | null {
  if (!planKeyOrId) return null;

  // Aufrufer übergeben mal den `planKey` (`free_audit`, aus der Datenbank),
  // mal die `PlanId` (`free`, aus der Oberfläche). Beides muss dieselbe
  // Antwort liefern — sonst zeigte der Marketplace für denselben Kunden je
  // nach Aufrufweg ein anderes Ergebnis.
  //
  // Auch Jahresvarianten (`growth_yearly`) landen so beim Basisplan, weil
  // `planByKey()` sie über `yearlyPlanKey` auflöst. Das entspricht dem
  // Auflöser in der Datenbank, der `_yearly` ebenfalls zurückführt.
  let satz = PLAN_ENTITLEMENTS[planKeyOrId];
  if (!satz) {
    const plan = PLANS.find((p) => p.id === planKeyOrId) ?? planByKey(planKeyOrId);
    if (plan) satz = PLAN_ENTITLEMENTS[plan.planKey];
  }
  if (!satz) return null;

  const wert = satz[key];
  return wert === undefined ? null : wert;
}

/**
 * Gewährt dieser Plan den Key?
 *
 * Dieselbe Regel wie im serverseitigen Wächter
 * (`supabase/functions/_shared/entitlements.ts`): `-1` (unbegrenzt) und jeder
 * Wert über null gelten als gewährt, `0` und „nicht enthalten" nicht.
 *
 * Freischalten tut das nichts — das entscheidet `tenant_entitlements()` auf
 * dem Server. Diese Funktion beantwortet die Frage „welcher Plan enthält
 * das?", etwa für den Marketplace.
 */
export function planGrants(
  planKey: string | null | undefined,
  key: EntitlementKey,
): boolean {
  const wert = planEntitlementValue(planKey, key);
  return wert !== null && (wert === -1 || wert > 0);
}


/**
 * Grace Period nach einer fehlgeschlagenen Zahlung, in Tagen.
 *
 * Entscheidung des Eigentümers vom 2026-08-24: Innerhalb dieser Frist bleibt
 * **alles** aktiv — Dashboard, Governance-Funktionen, Monitoring und geplante
 * Prüfungen. Erst danach werden die kostenpflichtigen Berechtigungen
 * pausiert. Daten, Konfiguration und Prüfpfad bleiben in jedem Fall erhalten.
 *
 * Die Zahl steht zwangsläufig zweimal: hier und als Intervall in
 * `20260829000000_grace_period.sql`, weil der Auflöser in SQL entscheidet und
 * die Oberfläche die verbleibenden Tage anzeigt.
 * `test/billing/grace-period.test.ts` bindet beide aneinander.
 */
export const GRACE_PERIOD_DAYS = 7;

/** Status, in denen ein Abo alle Berechtigungen trägt — ohne Fristprüfung. */
export const SUBSCRIPTION_STATES_ACTIVE = ['active', 'trialing'] as const;

/**
 * Verbleibende Tage der Grace Period.
 *
 * `null` heißt: keine Frist im Gange. Das gilt auch für `past_due` **ohne**
 * Zeitstempel — fehlt er (Altdaten oder ein Webhook-Ereignis, das nie ankam),
 * wird daraus keine Sperrung abgeleitet. Eine fehlende Information ist kein
 * Zahlungsverzug. Dieselbe Regel steht im Auflöser.
 */
export function graceDaysRemaining(
  status: string | null | undefined,
  pastDueSince: string | Date | null | undefined,
  now: Date,
): number | null {
  if (status !== 'past_due' || !pastDueSince) return null;
  const beginn = pastDueSince instanceof Date ? pastDueSince : new Date(pastDueSince);
  if (Number.isNaN(beginn.getTime())) return null;
  const vergangeneTage = (now.getTime() - beginn.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(GRACE_PERIOD_DAYS - vergangeneTage));
}

/**
 * Trägt dieses Abo derzeit die bezahlten Berechtigungen?
 *
 * Spiegelt `abo_wirksam` aus `20260829000000_grace_period.sql`. Die Oberfläche
 * darf damit nichts freischalten — das entscheidet der Server. Sie darf damit
 * nur *anzeigen*, was ohnehin gilt.
 */
export function subscriptionGrantsPaidAccess(
  status: string | null | undefined,
  pastDueSince: string | Date | null | undefined,
  now: Date,
): boolean {
  if (!status) return false;
  if ((SUBSCRIPTION_STATES_ACTIVE as readonly string[]).includes(status)) return true;
  if (status !== 'past_due') return false;
  if (!pastDueSince) return true; // fehlender Zeitstempel sperrt nicht
  const verbleibend = graceDaysRemaining(status, pastDueSince, now);
  return verbleibend === null || verbleibend > 0;
}

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
 * Die Pläne, die einem Neukunden **angeboten** werden — Free, Starter,
 * Growth und Enterprise (letzteres als Angebot).
 *
 * Bewusst nicht `ORDERED_PLANS`: Dort stehen weiterhin alle Ränge, weil
 * `planRank()` und `isUpgrade()` auch für Bestandskunden auf Agency oder
 * Partner die richtige Antwort geben müssen. Wer ein Preisraster, eine
 * Vergleichstabelle oder eine Planauswahl rendert, nimmt diese Liste —
 * sonst bietet die Oberfläche etwas an, das niemand mehr buchen kann
 * (`CLAUDE.md` §14: kein Element vortäuschen, das nichts tut).
 */
export const SALES_PLANS: Plan[] = ORDERED_PLANS.filter((p) => p.availability !== 'legacy');

/** Pläne, die ohne Vertrieb sofort buchbar sind. */
export const SELF_SERVICE_PLANS: Plan[] = ORDERED_PLANS.filter(
  (p) => p.availability === 'self_service',
);

/**
 * Stillgelegte Pläne. Sie erscheinen nirgends im Verkauf, bleiben aber
 * vollständig gültig, wo sie gebucht sind — Produkte, Preise und
 * Entitlements sind unverändert.
 */
export const LEGACY_PLANS: Plan[] = ORDERED_PLANS.filter((p) => p.availability === 'legacy');

/** Darf dieser Plan heute noch neu gewählt werden? */
export function isPlanSelectable(plan: Plan | PlanId | string | null | undefined): boolean {
  return resolvePlan(plan)?.availability !== 'legacy';
}

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
