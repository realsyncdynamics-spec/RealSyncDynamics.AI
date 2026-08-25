/**
 * SINGLE SOURCE OF TRUTH — Product, pricing and entitlements.
 *
 * Commercial ladder:
 * FREE AUDIT → START (€59/mo) → GROWTH (€149/mo) → BUSINESS (€349/mo)
 * → ENTERPRISE (individual / Sales).
 *
 * Legacy identifiers are accepted only at system boundaries and normalized
 * to canonical plans. They are never returned by the canonical catalog.
 *
 * Stripe Price IDs are intentionally absent. Stripe resolves the canonical
 * PlanKey through public.products.default_for_plan_key.
 */
export type ProductArea = 'govern' | 'automate' | 'engage';

export interface ProductAreaDefinition { id: ProductArea; label: string; summary: string; modules: ModuleId[]; }

export type GovernModuleId =
  | 'dsgvo' | 'eu_ai_act' | 'nis2' | 'dora' | 'iso_27001' | 'tisax'
  | 'policy_engine' | 'evidence_vault' | 'audit_center' | 'risk_register'
  | 'monitoring' | 'compliance_reports';
export type AutomateModuleId =
  | 'scheduler' | 'workflows' | 'n8n' | 'kodee' | 'bulk_jobs'
  | 'automation_engine' | 'alerts' | 'drift_detection' | 'remediation'
  | 'background_jobs';
export type EngageModuleId =
  | 'ai_bots' | 'voice' | 'whatsapp' | 'telegram' | 'website_chat'
  | 'api' | 'webhooks' | 'human_handoff' | 'multi_channel_messaging';
export type ModuleId = GovernModuleId | AutomateModuleId | EngageModuleId;

export interface ModuleDefinition {
  id: ModuleId;
  area: ProductArea;
  name: string;
  description: string;
  icon: string;
  policyPack?: boolean;
}

export const GOVERN_MODULES: ModuleDefinition[] = [
  { id: 'dsgvo', area: 'govern', name: 'DSGVO', description: 'Datenschutz-Grundverordnung und Prüfpfad.', icon: 'Shield', policyPack: true },
  { id: 'eu_ai_act', area: 'govern', name: 'EU AI Act', description: 'KI-Risikoklassifizierung, Transparenz und Dokumentation.', icon: 'Brain', policyPack: true },
  { id: 'nis2', area: 'govern', name: 'NIS2', description: 'Sicherheitsmaßnahmen, Meldepflichten und Fristen.', icon: 'Siren', policyPack: true },
  { id: 'dora', area: 'govern', name: 'DORA', description: 'Digitale operationale Resilienz und IKT-Drittparteienrisiko.', icon: 'Landmark', policyPack: true },
  { id: 'iso_27001', area: 'govern', name: 'ISO 27001', description: 'Informationssicherheits-Managementsystem und Kontrollen.', icon: 'Lock', policyPack: true },
  { id: 'tisax', area: 'govern', name: 'TISAX', description: 'Automotive-Informationssicherheit und VDA-ISA.', icon: 'Car', policyPack: true },
  { id: 'policy_engine', area: 'govern', name: 'Policy Engine', description: 'Versionierte Regeln als Code zur Laufzeit.', icon: 'Scale' },
  { id: 'evidence_vault', area: 'govern', name: 'Evidence Vault', description: 'Manipulationssichere Nachweise mit Hash-Chain.', icon: 'Archive' },
  { id: 'audit_center', area: 'govern', name: 'Audit Center', description: 'Prüfpfad, Audit-Läufe und Exporte.', icon: 'ClipboardCheck' },
  { id: 'risk_register', area: 'govern', name: 'Risk Register', description: 'Bewertung, Eigentümer und Maßnahmenverfolgung.', icon: 'AlertTriangle' },
  { id: 'monitoring', area: 'govern', name: 'Monitoring', description: 'Kontinuierliche Runtime-Überwachung.', icon: 'Activity' },
  { id: 'compliance_reports', area: 'govern', name: 'Compliance Reports', description: 'Exportfähige Berichte für Prüfer.', icon: 'FileText' },
];

export const AUTOMATE_MODULES: ModuleDefinition[] = [
  { id: 'scheduler', area: 'automate', name: 'Scheduler', description: 'Geplante Governance-Läufe.', icon: 'CalendarClock' },
  { id: 'workflows', area: 'automate', name: 'Workflows', description: 'Mehrstufige Governance-Abläufe.', icon: 'GitBranch' },
  { id: 'n8n', area: 'automate', name: 'n8n', description: 'Webhook- und Workflow-Anbindung.', icon: 'Workflow' },
  { id: 'kodee', area: 'automate', name: 'Kodee', description: 'Server-Operations-Assistent.', icon: 'Terminal' },
  { id: 'bulk_jobs', area: 'automate', name: 'Bulk Jobs', description: 'Massenläufe über viele Assets.', icon: 'Layers' },
  { id: 'automation_engine', area: 'automate', name: 'Automation Engine', description: 'Ausführung von Governance-Skills.', icon: 'Cpu' },
  { id: 'alerts', area: 'automate', name: 'Alerts', description: 'Benachrichtigungen bei Findings.', icon: 'Bell' },
  { id: 'drift_detection', area: 'automate', name: 'Drift Detection', description: 'Erkennt Abweichungen vom Soll-Zustand.', icon: 'TrendingUp' },
  { id: 'remediation', area: 'automate', name: 'Remediation', description: 'Review-pflichtige Maßnahmen.', icon: 'Wrench' },
  { id: 'background_jobs', area: 'automate', name: 'Background Jobs', description: 'Langlaufende Jobs mit Wiederaufnahme.', icon: 'Cog' },
];

export const ENGAGE_MODULES: ModuleDefinition[] = [
  { id: 'ai_bots', area: 'engage', name: 'AI Bots', description: 'Governance-Bots mit Logging und Risiko-Tags.', icon: 'Bot' },
  { id: 'voice', area: 'engage', name: 'Voice', description: 'Sprachkanal mit IVR, STT und TTS.', icon: 'Phone' },
  { id: 'whatsapp', area: 'engage', name: 'WhatsApp', description: 'WhatsApp-Business-Kanal.', icon: 'MessageCircle' },
  { id: 'telegram', area: 'engage', name: 'Telegram', description: 'Telegram-Bot-Kanal.', icon: 'Send' },
  { id: 'website_chat', area: 'engage', name: 'Website Chat', description: 'Eingebetteter Governance-Chat.', icon: 'MessageSquare' },
  { id: 'api', area: 'engage', name: 'API', description: 'REST-API für Runtime-Funktionen.', icon: 'Code' },
  { id: 'webhooks', area: 'engage', name: 'Webhooks', description: 'Signierte Ereignis-Zustellung.', icon: 'Webhook' },
  { id: 'human_handoff', area: 'engage', name: 'Human Handoff', description: 'Übergabe an Menschen.', icon: 'UserCheck' },
  { id: 'multi_channel_messaging', area: 'engage', name: 'Multi Channel Messaging', description: 'Konsistente Governance über Kanäle.', icon: 'Share2' },
];

export const ALL_MODULES: ModuleDefinition[] = [...GOVERN_MODULES, ...AUTOMATE_MODULES, ...ENGAGE_MODULES];
export const PRODUCT_AREAS: ProductAreaDefinition[] = [
  { id: 'govern', label: 'GOVERN', summary: 'Rahmenwerke, Richtlinien, Nachweise und Prüfpfad.', modules: GOVERN_MODULES.map((m) => m.id) },
  { id: 'automate', label: 'AUTOMATE', summary: 'Planung, Workflows und Maßnahmen.', modules: AUTOMATE_MODULES.map((m) => m.id) },
  { id: 'engage', label: 'ENGAGE', summary: 'Kanäle, Bots und Schnittstellen.', modules: ENGAGE_MODULES.map((m) => m.id) },
];
export const POLICY_PACK_IDS: GovernModuleId[] = GOVERN_MODULES.filter((m) => m.policyPack).map((m) => m.id as GovernModuleId);

export type CanonicalPlanId = 'free' | 'starter' | 'growth' | 'business' | 'enterprise' | 'governance_launch';
export type LegacyPlanId = 'agency' | 'partner' | 'scale';
export type PlanId = CanonicalPlanId | LegacyPlanId;
export type PlanKey =
  | 'free_audit'
  | 'starter' | 'starter_yearly'
  | 'growth' | 'growth_yearly'
  | 'business' | 'business_yearly'
  | 'enterprise'
  | 'governance_launch';
export type BillingInterval = 'none' | 'month' | 'year' | 'one_time';
export type PurchaseMode = 'free' | 'checkout' | 'inquiry' | 'one_time';
export type ChannelId = 'website' | 'whatsapp' | 'telegram' | 'slack' | 'teams' | 'email' | 'voice';

export interface PlanLimits {
  bots: number; answersPerMonth: number; domains: number; automationRunsPerMonth: number;
  seats: number; apiCallsPerMonth: number; tenants: number; evidenceStorageGb: number;
  auditReportsPerMonth: number; remediationPlans: number; bulkJobsPerMonth: number; apiKeys: number;
}
export interface PlanPermissions {
  scheduler: boolean; api: boolean; webhooks: boolean; whiteLabelReports: boolean;
  whiteLabelDashboard: boolean; multiTenant: boolean; evidenceVault: boolean; auditExport: boolean;
  sso: boolean; bulkOperations: boolean; provenanceSigning: boolean; prioritySupport: boolean;
}
export type SupportLevel = 'community' | 'email' | 'priority' | 'dedicated';
export type FeatureGroupId = 'audit_evidence' | 'ai_governance' | 'automation_ops' | 'multi_tenant_reseller';
export interface FeatureGroupDefinition { id: FeatureGroupId; label: string; summary: string; icon: string; }
export const FEATURE_GROUPS: FeatureGroupDefinition[] = [
  { id: 'audit_evidence', label: 'Audit & Evidence', summary: 'Prüfpfad und Nachweise.', icon: 'ClipboardCheck' },
  { id: 'ai_governance', label: 'AI Governance', summary: 'Rahmenwerke, Richtlinien und Risiken.', icon: 'Brain' },
  { id: 'automation_ops', label: 'Automation & Ops', summary: 'Laufender Betrieb und Maßnahmen.', icon: 'Cog' },
  { id: 'multi_tenant_reseller', label: 'Multi Tenant & Reseller', summary: 'Mandanten, Branding und Weiterverkauf.', icon: 'Building2' },
];
export type PlanFeatureMatrix = Record<FeatureGroupId, string[]>;
export interface PlanPrice { monthlyEur: number; yearlyEur: number | null; oneTimeEur: number | null; }
export interface Plan {
  id: CanonicalPlanId; planKey: PlanKey; yearlyPlanKey: PlanKey | null; name: string;
  outcomeHeadline: string; technicalSubheadline: string; price: PlanPrice; currency: 'EUR';
  purchaseMode: PurchaseMode; highlight: boolean; badges: string[]; ctaLabel: string;
  limits: PlanLimits; channels: ChannelId[]; modules: ModuleId[]; permissions: PlanPermissions;
  support: SupportLevel; addons: AddOnId[]; features: PlanFeatureMatrix; trialDays: number;
}

const ALL_CHANNELS: ChannelId[] = ['website', 'whatsapp', 'telegram', 'slack', 'teams', 'email', 'voice'];
const NO_PERMISSIONS: PlanPermissions = {
  scheduler: false, api: false, webhooks: false, whiteLabelReports: false, whiteLabelDashboard: false,
  multiTenant: false, evidenceVault: false, auditExport: false, sso: false, bulkOperations: false,
  provenanceSigning: false, prioritySupport: false,
};
const permissions = (overrides: Partial<PlanPermissions>): PlanPermissions => ({ ...NO_PERMISSIONS, ...overrides });
const emptyFeatures = (): PlanFeatureMatrix => ({ audit_evidence: [], ai_governance: [], automation_ops: [], multi_tenant_reseller: [] });
const limits = (overrides: Partial<PlanLimits>): PlanLimits => ({
  bots: 0, answersPerMonth: 0, domains: 1, automationRunsPerMonth: 0, seats: 1,
  apiCallsPerMonth: 0, tenants: 1, evidenceStorageGb: 0, auditReportsPerMonth: 0,
  remediationPlans: 0, bulkJobsPerMonth: 0, apiKeys: 0, ...overrides,
});

const START_MODULES: ModuleId[] = [
  'dsgvo', 'eu_ai_act', 'evidence_vault', 'audit_center', 'monitoring',
  'compliance_reports', 'automation_engine', 'alerts', 'ai_bots', 'website_chat',
];
const GROWTH_MODULES: ModuleId[] = [
  ...START_MODULES, 'iso_27001', 'policy_engine', 'risk_register', 'workflows',
  'drift_detection', 'remediation', 'background_jobs', 'whatsapp', 'telegram',
  'multi_channel_messaging',
];
const BUSINESS_MODULES: ModuleId[] = [
  ...GROWTH_MODULES, 'nis2', 'tisax', 'scheduler', 'n8n', 'kodee', 'bulk_jobs',
  'voice', 'api', 'webhooks', 'human_handoff',
];
const ENTERPRISE_MODULES: ModuleId[] = ALL_MODULES.map((m) => m.id);

const START_PERMISSIONS = permissions({ evidenceVault: true, auditExport: true });
const GROWTH_PERMISSIONS = permissions({ evidenceVault: true, auditExport: true });
const BUSINESS_PERMISSIONS = permissions({
  scheduler: true, api: true, webhooks: true, whiteLabelReports: true,
  evidenceVault: true, auditExport: true, bulkOperations: true,
  provenanceSigning: true, prioritySupport: true,
});
const ENTERPRISE_PERMISSIONS = permissions({
  scheduler: true, api: true, webhooks: true, whiteLabelReports: true,
  whiteLabelDashboard: true, multiTenant: true, evidenceVault: true, auditExport: true,
  sso: true, bulkOperations: true, provenanceSigning: true, prioritySupport: true,
});

export const PLANS: Plan[] = [
  {
    id: 'free', planKey: 'free_audit', yearlyPlanKey: null, name: 'Free Audit',
    outcomeHeadline: 'Sehen Sie in 90 Sekunden, wo Ihre Governance-Lücken liegen.',
    technicalSubheadline: 'Einmaliger Runtime-Scan mit Governance Score, Top-Risiken und Planempfehlung.',
    price: { monthlyEur: 0, yearlyEur: null, oneTimeEur: null }, currency: 'EUR',
    purchaseMode: 'free', highlight: false, badges: [], ctaLabel: 'Kostenlosen Audit starten',
    limits: limits({ domains: 1, evidenceStorageGb: 0.5, auditReportsPerMonth: 1 }),
    channels: [], modules: ['dsgvo', 'audit_center', 'compliance_reports'], permissions: permissions({}),
    support: 'community', addons: [], trialDays: 0,
    features: { ...emptyFeatures(), audit_evidence: ['Runtime-Scan einer Domain', 'Governance Score 0–100', 'Top-Risiken mit Paragraphenbezug', 'Kompakter PDF-Bericht'], ai_governance: ['DSGVO-Basisprüfung', 'Automatische Planempfehlung'] },
  },
  {
    id: 'starter', planKey: 'starter', yearlyPlanKey: 'starter_yearly', name: 'START',
    outcomeHeadline: 'Das nachweisbare Governance-Fundament für ein Unternehmen.',
    technicalSubheadline: 'Kontinuierliche DSGVO- und EU-AI-Act-Governance mit Evidence Vault und Audit Center.',
    price: { monthlyEur: 59, yearlyEur: 590, oneTimeEur: null }, currency: 'EUR',
    purchaseMode: 'checkout', highlight: false, badges: [], ctaLabel: 'Starten',
    limits: limits({ bots: 1, answersPerMonth: 500, domains: 1, automationRunsPerMonth: 25, seats: 1, evidenceStorageGb: 2, auditReportsPerMonth: 2, remediationPlans: 5 }),
    channels: ['website'], modules: START_MODULES, permissions: START_PERMISSIONS, support: 'email', addons: [], trialDays: 0,
    features: { ...emptyFeatures(), audit_evidence: ['Vollständiger DSGVO-Scan', 'Evidence Vault mit Hash-Chain', 'Audit-Export als PDF und JSON', 'Lückenloser Prüfpfad'], ai_governance: ['DSGVO und EU AI Act', 'Policy-basierte Empfehlungen'], automation_ops: ['Kontinuierliches Monitoring', '25 Automationsläufe pro Monat', '1 Governance-Bot mit 500 Antworten'] },
  },
  {
    id: 'growth', planKey: 'growth', yearlyPlanKey: 'growth_yearly', name: 'GROWTH',
    outcomeHeadline: 'KI-Governance, die sich kontinuierlich selbst überwacht.',
    technicalSubheadline: 'Tägliche Runtime-Läufe mit Drift Detection, Risk Register und versionierter Policy Engine.',
    price: { monthlyEur: 149, yearlyEur: 1490, oneTimeEur: null }, currency: 'EUR',
    purchaseMode: 'checkout', highlight: true, badges: ['Empfohlen'], ctaLabel: '14 Tage kostenlos testen',
    limits: limits({ bots: 2, answersPerMonth: 2000, domains: 3, automationRunsPerMonth: 100, seats: 5, evidenceStorageGb: 10, auditReportsPerMonth: 12, remediationPlans: 20 }),
    channels: ['website', 'whatsapp', 'telegram'], modules: GROWTH_MODULES, permissions: GROWTH_PERMISSIONS, support: 'priority',
    addons: ['response_pack', 'whatsapp', 'compliance_pack'], trialDays: 14,
    features: { ...emptyFeatures(), audit_evidence: ['Alles aus START', 'Versionierter Evidence Vault', 'Bis zu 12 Audit-Berichte pro Monat'], ai_governance: ['DSGVO, EU AI Act, ISO 27001', 'Policy Engine', 'AI Risk Register'], automation_ops: ['Tägliches Monitoring mit Drift Detection', 'Behebungsvorschläge', '100 Automationsläufe pro Monat', '2 Governance-Bots mit 2.000 Antworten'] },
  },
  {
    id: 'business', planKey: 'business', yearlyPlanKey: 'business_yearly', name: 'BUSINESS',
    outcomeHeadline: 'Die vollständige operative Governance Runtime für wachsende Teams.',
    technicalSubheadline: 'Erweiterte Policy Packs, Automation, API, Bulk Operations, Herkunftsnachweise und White-Label-Berichte.',
    price: { monthlyEur: 349, yearlyEur: 3490, oneTimeEur: null }, currency: 'EUR',
    purchaseMode: 'checkout', highlight: false, badges: ['Für Teams'], ctaLabel: 'Business starten',
    limits: limits({ bots: 10, answersPerMonth: 25000, domains: 10, automationRunsPerMonth: 500, seats: 15, apiCallsPerMonth: 50000, evidenceStorageGb: 50, auditReportsPerMonth: 50, remediationPlans: 100, bulkJobsPerMonth: 100, apiKeys: 10 }),
    channels: ALL_CHANNELS, modules: BUSINESS_MODULES, permissions: BUSINESS_PERMISSIONS, support: 'priority',
    addons: ['response_pack', 'whatsapp', 'voice', 'compliance_pack', 'agency_bot_pack', 'white_label'], trialDays: 0,
    features: { ...emptyFeatures(), audit_evidence: ['Alles aus GROWTH', 'Advanced Evidence Vault', 'Ed25519-Herkunftsnachweis', 'White-Label-Audit-Berichte'], ai_governance: ['DSGVO, EU AI Act, ISO 27001, NIS2, TISAX', 'Governance Agents mit Review-Pflicht'], automation_ops: ['Scheduler und Alerts', 'Bulk Jobs', 'n8n und Kodee', 'REST-API und Webhooks', '500 Automationsläufe pro Monat'], multi_tenant_reseller: ['White-Label-Berichte', 'Bis zu 10 Domains'] },
  },
  {
    id: 'enterprise', planKey: 'enterprise', yearlyPlanKey: null, name: 'ENTERPRISE',
    outcomeHeadline: 'Konzernweite Governance mit individueller Architektur und SLA.',
    technicalSubheadline: 'Individuell dimensionierte Multi-Tenant-Runtime mit SSO, zentraler Rechteverwaltung und dediziertem Support.',
    price: { monthlyEur: 0, yearlyEur: null, oneTimeEur: null }, currency: 'EUR',
    purchaseMode: 'inquiry', highlight: false, badges: ['Individuell'], ctaLabel: 'Enterprise anfragen',
    limits: limits({ bots: -1, answersPerMonth: -1, domains: -1, automationRunsPerMonth: -1, seats: -1, apiCallsPerMonth: -1, tenants: -1, evidenceStorageGb: -1, auditReportsPerMonth: -1, remediationPlans: -1, bulkJobsPerMonth: -1, apiKeys: -1 }),
    channels: ALL_CHANNELS, modules: ENTERPRISE_MODULES, permissions: ENTERPRISE_PERMISSIONS, support: 'dedicated',
    addons: ['response_pack', 'whatsapp', 'voice', 'compliance_pack', 'agency_bot_pack', 'white_label'], trialDays: 0,
    features: { ...emptyFeatures(), audit_evidence: ['Alles aus BUSINESS', 'Individuelle Evidence- und Audit-Kapazität'], ai_governance: ['Alle Policy Packs', 'Individuelle Richtlinien und Kontrollkataloge'], automation_ops: ['Individuelle Runtime- und API-Kontingente', 'SLA und dedizierter Support'], multi_tenant_reseller: ['Multi-Tenant-Dashboard', 'SSO', 'Vollständiges White-Label'] },
  },
  {
    id: 'governance_launch', planKey: 'governance_launch', yearlyPlanKey: null, name: 'Governance Launch',
    outcomeHeadline: 'Einmalige Governance-Implementierung für den ersten Anwendungsfall.',
    technicalSubheadline: 'Einrichtung von Rahmenwerk, Evidence Vault und Audit Center für eine Domain.',
    price: { monthlyEur: 0, yearlyEur: null, oneTimeEur: 349 }, currency: 'EUR',
    purchaseMode: 'one_time', highlight: false, badges: ['Einmalig'], ctaLabel: 'Jetzt buchen',
    limits: limits({ bots: 1, answersPerMonth: 1000, domains: 1, automationRunsPerMonth: 10, seats: 3, evidenceStorageGb: 5, auditReportsPerMonth: 5 }),
    channels: ['website'], modules: ['dsgvo', 'policy_engine', 'evidence_vault', 'audit_center', 'compliance_reports'],
    permissions: permissions({ evidenceVault: true, auditExport: true }), support: 'email', addons: [], trialDays: 0,
    features: { ...emptyFeatures(), audit_evidence: ['Evidence Vault mit 5 GB', 'Audit Center', 'Fünf Audit-Berichte'], ai_governance: ['DSGVO Policy Pack', 'Policy Engine', 'Compliance Reports'], automation_ops: ['Zehn Einrichtungsläufe'] },
  },
];

export type AddOnId = 'response_pack' | 'whatsapp' | 'voice' | 'compliance_pack' | 'agency_bot_pack' | 'white_label';
export interface AddOn {
  id: AddOnId; name: string; description: string; priceEur: number; priceNote: string;
  interval: 'month'; bullets: string[]; availableFor: PlanId[];
}
export const ADDONS: AddOn[] = [
  { id: 'response_pack', name: 'Response Pack', description: 'Zusätzliche Bot-Antworten.', priceEur: 49, priceNote: '/ Monat', interval: 'month', bullets: ['Weitere 5.000 Antworten pro Monat'], availableFor: ['growth', 'business', 'enterprise'] },
  { id: 'whatsapp', name: 'WhatsApp', description: 'WhatsApp-Business-Kanal.', priceEur: 99, priceNote: '/ Monat', interval: 'month', bullets: ['WhatsApp Business API'], availableFor: ['growth', 'business', 'enterprise'] },
  { id: 'voice', name: 'Voice', description: 'Sprachkanal über Telefonie.', priceEur: 150, priceNote: '/ Monat zzgl. Verbrauch', interval: 'month', bullets: ['Telefonie', 'STT/TTS'], availableFor: ['business', 'enterprise'] },
  { id: 'compliance_pack', name: 'Compliance Pack', description: 'Erweitertes Logging und Review-Workflows.', priceEur: 149, priceNote: '/ Monat', interval: 'month', bullets: ['Erweitertes Logging'], availableFor: ['growth', 'business', 'enterprise'] },
  { id: 'agency_bot_pack', name: 'Agency Bot Pack', description: 'Zusätzliche Governance-Bots.', priceEur: 199, priceNote: '/ Monat', interval: 'month', bullets: ['Fünf weitere produktive Bots'], availableFor: ['business', 'enterprise'] },
  { id: 'white_label', name: 'White Label', description: 'Vollständiges Branding.', priceEur: 299, priceNote: '/ Monat', interval: 'month', bullets: ['Subdomain oder eigene Domain'], availableFor: ['business', 'enterprise'] },
];

export type ProductTrack = 'keep_frontend' | 'modernize_frontend';
export const PRODUCT_TRACKS: ProductTrack[] = ['keep_frontend', 'modernize_frontend'];
export function isProductTrack(value: string | null | undefined): value is ProductTrack {
  return value === 'keep_frontend' || value === 'modernize_frontend';
}

export type BookableModuleId =
  | 'governance_core' | 'ai_frontend' | 'website_chat' | 'voice_bot' | 'whatsapp_bot'
  | 'booking' | 'advanced_ai_governance' | 'additional_domain' | 'additional_company';
export type ModulePriceModel = 'flat' | 'flat_plus_usage' | 'per_unit' | 'credits';
export interface BookableModule {
  id: BookableModuleId; name: string; description: string; priceEur: number;
  priceModel: ModulePriceModel; usageNote: string | null; required: boolean;
  requiresFrontend: boolean; unlocks: ModuleId[]; icon: string; bullets: string[];
}
export const MODULE_PRICING_STATUS = 'provisional' as const;
export const MODULE_ADDON_PRICE_DIVERGENCE: BookableModuleId[] = ['voice_bot', 'whatsapp_bot'];
export const BOOKABLE_MODULES: BookableModule[] = [
  { id: 'governance_core', name: 'Governance Core', description: 'Kontinuierliche Governance für ein Unternehmen und eine Domain.', priceEur: 59, priceModel: 'flat', usageNote: null, required: true, requiresFrontend: false, unlocks: ['dsgvo','eu_ai_act','policy_engine','evidence_vault','audit_center','monitoring','compliance_reports','alerts'], icon: 'Shield', bullets: ['Ein Unternehmen, eine Domain','DSGVO und EU AI Act','Kontinuierliches Monitoring','Evidence Vault und Audit-Export'] },
  { id: 'ai_frontend', name: 'AI Frontend Studio', description: 'Generiert ein neues Frontend aus vorhandenen Inhalten.', priceEur: 0, priceModel: 'credits', usageNote: 'Credits / Usage werden separat abgerechnet.', required: false, requiresFrontend: true, unlocks: [], icon: 'LayoutTemplate', bullets: ['Inhalts-Inventar','Preview und Freigabe','Original bleibt wiederherstellbar','Responsive und SEO-erhaltend'] },
  { id: 'website_chat', name: 'Website Chat', description: 'Governance-Chat auch auf einem fremden Frontend.', priceEur: 39, priceModel: 'flat_plus_usage', usageNote: 'zzgl. Verbrauch je Konversation', required: false, requiresFrontend: false, unlocks: ['website_chat','ai_bots'], icon: 'MessageSquare', bullets: ['Snippet-Einbindung','Prüfpfad je Antwort','EU-AI-Act-Transparenzhinweis'] },
  { id: 'voice_bot', name: 'Voice Bot', description: 'Telefonischer Sprachkanal.', priceEur: 99, priceModel: 'flat_plus_usage', usageNote: 'zzgl. Telefonie- und Sprachverbrauch je Minute', required: false, requiresFrontend: false, unlocks: ['voice','ai_bots','human_handoff'], icon: 'Phone', bullets: ['STT/TTS','Human Handoff','Verbrauchsabhängige Abrechnung'] },
  { id: 'whatsapp_bot', name: 'WhatsApp Bot', description: 'WhatsApp-Business-Kanal.', priceEur: 39, priceModel: 'flat_plus_usage', usageNote: 'zzgl. WhatsApp-Konversationsgebühren', required: false, requiresFrontend: false, unlocks: ['whatsapp','ai_bots','multi_channel_messaging'], icon: 'MessageCircle', bullets: ['WhatsApp Business API','Ein Bot, mehrere Kanäle','Durchgereichte Konversationsgebühren'] },
  { id: 'booking', name: 'Terminbuchung', description: 'Zentrale Booking Engine.', priceEur: 29, priceModel: 'flat', usageNote: null, required: false, requiresFrontend: false, unlocks: [], icon: 'CalendarClock', bullets: ['Zentrale Slot-Berechnung','Urlaub und Pausen','Variable Termindauer'] },
  { id: 'advanced_ai_governance', name: 'Advanced AI Governance', description: 'Erweiterte Governance über den Core hinaus.', priceEur: 149, priceModel: 'flat', usageNote: null, required: false, requiresFrontend: false, unlocks: ['nis2','iso_27001','risk_register','remediation','drift_detection'], icon: 'Brain', bullets: ['NIS2 und ISO 27001','Risk Register','Drift Detection','Remediation'] },
  { id: 'additional_domain', name: 'Weitere Domain', description: 'Zusätzliche überwachte Domain.', priceEur: 19, priceModel: 'per_unit', usageNote: 'je Domain und Monat', required: false, requiresFrontend: false, unlocks: [], icon: 'Globe', bullets: ['Eigener Governance Score','Gemeinsames Evidence Vault'] },
  { id: 'additional_company', name: 'Weiteres Unternehmen', description: 'Zusätzliches Unternehmen mit getrennter Governance.', priceEur: 49, priceModel: 'per_unit', usageNote: 'je Unternehmen und Monat', required: false, requiresFrontend: false, unlocks: ['multi_channel_messaging'], icon: 'Building2', bullets: ['Eigene Domains und Bots','Mandantentrennung über RLS'] },
];
export const REQUIRED_MODULES = BOOKABLE_MODULES.filter((m) => m.required);
export const OPTIONAL_MODULES = BOOKABLE_MODULES.filter((m) => !m.required);
export function bookableModuleById(id: BookableModuleId): BookableModule | undefined { return BOOKABLE_MODULES.find((m) => m.id === id); }
export function modulesForTrack(track: ProductTrack): BookableModule[] {
  return track === 'modernize_frontend' ? BOOKABLE_MODULES : BOOKABLE_MODULES.filter((m) => !m.requiresFrontend);
}
export function monthlyBaseTotalEur(selection: readonly BookableModuleId[]): number {
  const ids = new Set<BookableModuleId>(selection);
  for (const module of REQUIRED_MODULES) ids.add(module.id);
  return [...ids].reduce((sum, id) => sum + (bookableModuleById(id)?.priceEur ?? 0), 0);
}
export function hasUsageBasedModules(selection: readonly BookableModuleId[]): boolean {
  const ids = new Set<BookableModuleId>(selection);
  for (const module of REQUIRED_MODULES) ids.add(module.id);
  return [...ids].some((id) => {
    const model = bookableModuleById(id)?.priceModel;
    return model === 'flat_plus_usage' || model === 'credits';
  });
}
export function normalizeModuleSelection(raw: readonly string[]): BookableModuleId[] {
  const wanted = new Set(raw);
  return BOOKABLE_MODULES.filter((m) => m.required || wanted.has(m.id)).map((m) => m.id);
}

export interface RuntimeStage { id: string; label: string; description: string; icon: string; }
export const RUNTIME_PIPELINE: RuntimeStage[] = [
  { id: 'source', label: 'Website / API', description: 'Systeme, Domains und Schnittstellen.', icon: 'Globe' },
  { id: 'scan', label: 'Runtime Scan', description: 'Kontinuierliche Erfassung des Ist-Zustands.', icon: 'Radar' },
  { id: 'policy', label: 'Policy Engine', description: 'Abgleich gegen versionierte Richtlinien.', icon: 'Scale' },
  { id: 'evidence', label: 'Evidence Vault', description: 'Manipulationssichere Nachweise.', icon: 'Archive' },
  { id: 'risk', label: 'Risk Engine', description: 'Bewertung und Priorisierung.', icon: 'AlertTriangle' },
  { id: 'automation', label: 'Automation', description: 'Geplante Läufe und Maßnahmen.', icon: 'Cog' },
  { id: 'export', label: 'Audit Export', description: 'Prüferfertige Nachweispakete.', icon: 'FileOutput' },
];

export const PLAN_ORDER: CanonicalPlanId[] = ['free', 'starter', 'growth', 'business', 'enterprise'];
const LEGACY_PLAN_ID_ALIASES: Record<LegacyPlanId, CanonicalPlanId> = { agency: 'business', partner: 'enterprise', scale: 'enterprise' };
const LEGACY_PLAN_KEY_ALIASES: Record<string, PlanKey> = {
  agency: 'business', agency_yearly: 'business_yearly',
  partner: 'enterprise', partner_yearly: 'enterprise',
  scale: 'enterprise', scale_yearly: 'enterprise',
  free: 'free_audit', free_tier: 'free_audit', 'free-audit': 'free_audit',
};
const ALL_PLAN_KEYS: PlanKey[] = PLANS.flatMap((p) => p.yearlyPlanKey ? [p.planKey, p.yearlyPlanKey] : [p.planKey]);

export function normalizePlanKey(raw: string | null | undefined): PlanKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return isPlanKey(key) ? key : LEGACY_PLAN_KEY_ALIASES[key] ?? null;
}
export function isPlanKey(value: string): value is PlanKey { return (ALL_PLAN_KEYS as string[]).includes(value); }
export function allPlanKeys(): PlanKey[] { return [...ALL_PLAN_KEYS]; }
export function isPlanId(value: string): value is PlanId { return PLANS.some((p) => p.id === value) || value in LEGACY_PLAN_ID_ALIASES; }
export function planById(id: PlanId): Plan {
  const canonicalId = id in LEGACY_PLAN_ID_ALIASES ? LEGACY_PLAN_ID_ALIASES[id as LegacyPlanId] : id as CanonicalPlanId;
  const plan = PLANS.find((p) => p.id === canonicalId);
  if (!plan) throw new Error(`[pricing] unbekannte PlanId: ${id}`);
  return plan;
}
export function planByKey(rawKey: string | null | undefined): Plan | null {
  const key = normalizePlanKey(rawKey);
  return key ? PLANS.find((p) => p.planKey === key || p.yearlyPlanKey === key) ?? null : null;
}
export function isYearlyPlanKey(rawKey: string | null | undefined): boolean {
  const key = normalizePlanKey(rawKey);
  return key ? PLANS.some((p) => p.yearlyPlanKey === key) : false;
}
export function intervalForPlanKey(rawKey: string | null | undefined): BillingInterval {
  const plan = planByKey(rawKey);
  if (!plan) return 'none';
  if (plan.purchaseMode === 'one_time') return 'one_time';
  if (plan.price.monthlyEur === 0) return 'none';
  return isYearlyPlanKey(rawKey) ? 'year' : 'month';
}
export function priceForPlanKey(rawKey: string | null | undefined): number | null {
  const plan = planByKey(rawKey);
  if (!plan) return null;
  if (plan.purchaseMode === 'one_time') return plan.price.oneTimeEur;
  return isYearlyPlanKey(rawKey) ? plan.price.yearlyEur : plan.price.monthlyEur;
}
export function planKeyFor(id: PlanId, interval: 'month' | 'year' = 'month'): PlanKey {
  const plan = planById(id);
  return interval === 'year' && plan.yearlyPlanKey ? plan.yearlyPlanKey : plan.planKey;
}
export const PAID_PLANS: Plan[] = PLANS.filter((p) => p.price.monthlyEur > 0 || p.purchaseMode === 'inquiry');
export const ORDERED_PLANS: Plan[] = PLAN_ORDER.map((id) => planById(id));
export const ONE_TIME_PLANS: Plan[] = PLANS.filter((p) => p.purchaseMode === 'one_time');
export const ALL_PLANS_ORDERED: Plan[] = [...ORDERED_PLANS, ...ONE_TIME_PLANS];
export function isOneTimePlan(rawKey: string | null | undefined): boolean { return planByKey(rawKey)?.purchaseMode === 'one_time'; }
export function planRank(id: PlanId): number {
  const canonicalId = id in LEGACY_PLAN_ID_ALIASES ? LEGACY_PLAN_ID_ALIASES[id as LegacyPlanId] : id as CanonicalPlanId;
  return PLAN_ORDER.indexOf(canonicalId);
}
export function isUpgrade(current: PlanId, candidate: PlanId): boolean {
  const a = planRank(current), b = planRank(candidate);
  return a >= 0 && b >= 0 && b > a;
}
export type PermissionKey = keyof PlanPermissions;
export function resolvePlan(plan: Plan | PlanId | string | null | undefined): Plan | null {
  if (!plan) return null;
  if (typeof plan === 'object') return plan;
  return isPlanId(plan) ? planById(plan) : planByKey(plan);
}
export function hasPermission(plan: Plan | PlanId | string | null | undefined, permission: PermissionKey): boolean {
  return resolvePlan(plan)?.permissions[permission] === true;
}
export function hasModule(plan: Plan | PlanId | string | null | undefined, moduleId: ModuleId): boolean {
  return resolvePlan(plan)?.modules.includes(moduleId) ?? false;
}
export function hasChannel(plan: Plan | PlanId | string | null | undefined, channel: ChannelId): boolean {
  return resolvePlan(plan)?.channels.includes(channel) ?? false;
}
export function limitOf(plan: Plan | PlanId | string | null | undefined, limit: keyof PlanLimits): number {
  return resolvePlan(plan)?.limits[limit] ?? 0;
}
export function withinLimit(plan: Plan | PlanId | string | null | undefined, limit: keyof PlanLimits, current: number): boolean {
  const max = limitOf(plan, limit);
  return max === -1 || current < max;
}
export function policyPacksFor(plan: Plan | PlanId | string | null | undefined): GovernModuleId[] {
  const p = resolvePlan(plan);
  return p ? POLICY_PACK_IDS.filter((id) => p.modules.includes(id)) : [];
}
export function modulesForArea(plan: Plan | PlanId | string | null | undefined, area: ProductArea): ModuleDefinition[] {
  const p = resolvePlan(plan);
  return p ? ALL_MODULES.filter((m) => m.area === area && p.modules.includes(m.id)) : [];
}
export function moduleById(id: ModuleId): ModuleDefinition | undefined { return ALL_MODULES.find((m) => m.id === id); }
export function minimumPlanForModule(moduleId: ModuleId): PlanId | null {
  return PLAN_ORDER.find((id) => planById(id).modules.includes(moduleId)) ?? null;
}
export function minimumPlanForPermission(permission: PermissionKey): PlanId | null {
  return PLAN_ORDER.find((id) => planById(id).permissions[permission]) ?? null;
}
export function addonsFor(plan: Plan | PlanId | string | null | undefined): AddOn[] {
  const p = resolvePlan(plan);
  return p ? ADDONS.filter((a) => p.addons.includes(a.id)) : [];
}
export function addonById(id: AddOnId): AddOn | undefined { return ADDONS.find((a) => a.id === id); }

export interface PlanRecommendation { planId: CanonicalPlanId; reason: string; }
export interface RecommendationInput { score: number; domains?: number; tenants?: number; needsApi?: boolean; needsWhiteLabel?: boolean; }
export function recommendPlan(input: RecommendationInput): PlanRecommendation {
  const { score, domains = 1, tenants = 1, needsApi = false, needsWhiteLabel = false } = input;
  if (tenants > 1) return { planId: 'enterprise', reason: `${tenants} Organisationen erfordern Enterprise-Mandantenverwaltung.` };
  if (needsApi || needsWhiteLabel || domains > planById('growth').limits.domains) {
    return { planId: 'business', reason: 'API, Webhooks, White-Label oder mehr Domains erfordern BUSINESS.' };
  }
  if (score < 70) return { planId: 'growth', reason: `Governance Score ${score}/100 — kontinuierliche Überwachung und Risk Register werden empfohlen.` };
  return { planId: 'starter', reason: `Governance Score ${score}/100 — die solide Basis kann nachweisbar betrieben werden.` };
}
export function checkoutHrefForPlan(plan: Plan | PlanId, options: { interval?: 'month' | 'year'; source?: string } = {}): string {
  const resolved = typeof plan === 'string' ? planById(plan) : plan;
  const { interval = 'month', source = 'pricing' } = options;
  const key = planKeyFor(resolved.id, interval);
  if (resolved.purchaseMode === 'free') return `/audit?source=${encodeURIComponent(source)}`;
  if (resolved.purchaseMode === 'inquiry') return `/contact-sales?plan=${encodeURIComponent(key)}&source=${encodeURIComponent(source)}`;
  const trial = resolved.trialDays > 0 ? '&pilot=true' : '';
  return `/checkout/${key}?source=${encodeURIComponent(source)}${trial}`;
}
export function formatPriceEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}
export function formatLimit(value: number): string {
  if (value === -1) return 'unbegrenzt';
  if (value === 0) return '—';
  return new Intl.NumberFormat('de-DE').format(value);
}
export function yearlySavingsEur(plan: Plan | PlanId): number {
  const p = typeof plan === 'string' ? planById(plan) : plan;
  return p.price.yearlyEur === null ? 0 : p.price.monthlyEur * 12 - p.price.yearlyEur;
}
export const PRODUCT_POSITIONING = 'AI Governance Runtime';
export const PRICING_TRUST_NOTE = 'Free Audit kostenlos · Growth 14 Tage kostenlos testen · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany';
export const PRICING_TAX_NOTE = 'Alle Preise zzgl. gesetzlicher Umsatzsteuer.';
