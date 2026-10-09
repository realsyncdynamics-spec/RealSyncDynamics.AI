/**
 * KI-Register (Auftrag §14) — Felder je System und die Register-Ampel.
 *
 * Die Wertelisten sind dieselben wie die CHECK-Constraints in
 * 20261005130000_governance_assets_ai_registry_fields.sql und in
 * supabase/functions/governance-resources/registryFields.ts
 * (Parität: test/governance/ai-registry-parity.test.ts).
 *
 * AMPEL — Regeln (bewusst ohne Anbieter- oder Logo-Bezug):
 *   rot                 verbotene Praxis (Art. 5) · Hochrisiko ohne jeden Nachweis
 *   unzureichende Daten Typ, Betrieb, Datenstandort oder AI-Act-Klasse fehlt/unbekannt
 *   gelb                Hochrisiko (Pflichten Art. 9–15, 26) · Drittland ohne
 *                       Angemessenheitsbeschluss · keine verantwortliche Person ·
 *                       kein Nachweis · jüngster Nachweis älter als 365 Tage
 *   grün                nichts davon — und mindestens ein Nachweis aus den letzten 365 Tagen
 * Rote Gründe stechen fehlende Daten (ein bekanntes Verbot bleibt rot). Ohne
 * Datenbasis gibt es nie Grün.
 */
import type { DbGovernanceAsset } from '../governanceApi';

export const AI_SYSTEM_TYPES = ['external_ai', 'local_ai', 'agent', 'bot', 'workflow', 'browser_agent'] as const;
export const DEPLOYMENT_MODELS = ['vendor_cloud', 'own_cloud', 'on_premises', 'local_device'] as const;
export const DATA_RESIDENCIES = ['eu', 'adequacy', 'third_country', 'unknown'] as const;
export const EDITABLE_STATUSES = ['draft', 'active', 'under_review', 'approved'] as const;

export type AiSystemType = (typeof AI_SYSTEM_TYPES)[number];
export type DeploymentModel = (typeof DEPLOYMENT_MODELS)[number];
export type DataResidency = (typeof DATA_RESIDENCIES)[number];
export type EditableStatus = (typeof EDITABLE_STATUSES)[number];

type Bilingual = { de: string; en: string };

export const AI_SYSTEM_TYPE_LABEL: Record<AiSystemType, Bilingual> = {
  external_ai: { de: 'Externe KI (Dienst/API)', en: 'External AI (service/API)' },
  local_ai: { de: 'Lokale KI', en: 'Local AI' },
  agent: { de: 'Agent', en: 'Agent' },
  bot: { de: 'Bot', en: 'Bot' },
  workflow: { de: 'Workflow/Automatisierung', en: 'Workflow/automation' },
  browser_agent: { de: 'Browser-Agent', en: 'Browser agent' },
};

export const DEPLOYMENT_MODEL_LABEL: Record<DeploymentModel, Bilingual> = {
  vendor_cloud: { de: 'Anbieter-Cloud (SaaS/API)', en: 'Vendor cloud (SaaS/API)' },
  own_cloud: { de: 'Eigene Cloud-Instanz', en: 'Own cloud instance' },
  on_premises: { de: 'Eigenes Rechenzentrum', en: 'On-premises' },
  local_device: { de: 'Lokal auf Endgerät', en: 'Local device' },
};

export const DATA_RESIDENCY_LABEL: Record<DataResidency, Bilingual> = {
  eu: { de: 'EU/EWR', en: 'EU/EEA' },
  adequacy: { de: 'Drittland mit Angemessenheitsbeschluss', en: 'Third country with adequacy decision' },
  third_country: { de: 'Drittland ohne Angemessenheitsbeschluss', en: 'Third country without adequacy decision' },
  unknown: { de: 'Unbekannt', en: 'Unknown' },
};

export const STATUS_LABEL: Record<EditableStatus | 'archived', Bilingual> = {
  draft: { de: 'Entwurf', en: 'Draft' },
  active: { de: 'In Betrieb', en: 'In operation' },
  under_review: { de: 'In Prüfung', en: 'Under review' },
  approved: { de: 'Freigegeben', en: 'Approved' },
  archived: { de: 'Archiviert', en: 'Archived' },
};

function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

export function aiSystemTypeOf(asset: Pick<DbGovernanceAsset, 'ai_system_type'>): AiSystemType | null {
  return isOneOf(AI_SYSTEM_TYPES, asset.ai_system_type) ? asset.ai_system_type : null;
}
export function deploymentModelOf(asset: Pick<DbGovernanceAsset, 'deployment_model'>): DeploymentModel | null {
  return isOneOf(DEPLOYMENT_MODELS, asset.deployment_model) ? asset.deployment_model : null;
}
export function dataResidencyOf(asset: Pick<DbGovernanceAsset, 'data_residency'>): DataResidency | null {
  return isOneOf(DATA_RESIDENCIES, asset.data_residency) ? asset.data_residency : null;
}

/** Spiegelt governance-resources (isOwnerOrAdmin) — entscheidend bleibt der Server. */
export function canEditRegistry(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function label(map: Record<string, Bilingual>, key: string | null | undefined, lang: 'de' | 'en'): string | null {
  if (!key || !(key in map)) return null;
  return map[key]![lang];
}

// ─── Nachweise ────────────────────────────────────────────────────────────

export interface EvidenceStats {
  count: number;
  latestAt: string | null;
}

// ─── Ampel ────────────────────────────────────────────────────────────────

export type RegistryLight = 'green' | 'amber' | 'red' | 'insufficient_data';

export type RegistryReason =
  | 'prohibited_practice'
  | 'high_risk_without_evidence'
  | 'missing_type'
  | 'missing_deployment'
  | 'missing_residency'
  | 'missing_class'
  | 'high_risk_obligations'
  | 'third_country_transfer'
  | 'no_owner'
  | 'no_evidence'
  | 'evidence_stale'
  | 'evidence_recent';

export interface RegistryAssessment {
  light: RegistryLight;
  reasons: RegistryReason[];
}

export const STALE_EVIDENCE_DAYS = 365;

type AssessableAsset = Pick<
  DbGovernanceAsset,
  'ai_act_class' | 'owner_email' | 'ai_system_type' | 'deployment_model' | 'data_residency'
>;

/**
 * Register-Ampel aus Deployment-Konfiguration und Nachweisen. `evidence`
 * `null` heißt: Nachweise konnten nicht geladen werden — dann gibt es keine
 * Aussage darüber, also nie Grün.
 */
export function assessRegistryEntry(
  asset: AssessableAsset,
  evidence: EvidenceStats | null,
  now: Date = new Date(),
): RegistryAssessment {
  const red: RegistryReason[] = [];
  const missing: RegistryReason[] = [];
  const amber: RegistryReason[] = [];

  const klass = asset.ai_act_class;
  const hasEvidence = evidence !== null && evidence.count > 0;

  if (klass === 'prohibited') red.push('prohibited_practice');
  if (klass === 'high' && evidence !== null && evidence.count === 0) red.push('high_risk_without_evidence');

  if (!aiSystemTypeOf(asset)) missing.push('missing_type');
  if (!deploymentModelOf(asset)) missing.push('missing_deployment');
  const residency = dataResidencyOf(asset);
  if (!residency || residency === 'unknown') missing.push('missing_residency');
  if (!klass || klass === 'unknown') missing.push('missing_class');

  if (red.length > 0) return { light: 'red', reasons: [...red, ...missing] };
  if (missing.length > 0 || evidence === null) return { light: 'insufficient_data', reasons: missing };

  if (klass === 'high') amber.push('high_risk_obligations');
  if (residency === 'third_country') amber.push('third_country_transfer');
  if (!asset.owner_email) amber.push('no_owner');
  if (!hasEvidence) {
    amber.push('no_evidence');
  } else if (evidence.latestAt) {
    const ageDays = (now.getTime() - new Date(evidence.latestAt).getTime()) / 86_400_000;
    if (!(ageDays <= STALE_EVIDENCE_DAYS)) amber.push('evidence_stale');
  }

  if (amber.length > 0) return { light: 'amber', reasons: amber };
  return { light: 'green', reasons: ['evidence_recent'] };
}

export const REGISTRY_LIGHT_LABEL: Record<RegistryLight, Bilingual> = {
  green: { de: 'Grün', en: 'Green' },
  amber: { de: 'Gelb', en: 'Amber' },
  red: { de: 'Rot', en: 'Red' },
  insufficient_data: { de: 'Unzureichende Daten', en: 'Insufficient data' },
};

export const REGISTRY_REASON_LABEL: Record<RegistryReason, Bilingual> = {
  prohibited_practice: { de: 'Als verbotene Praxis eingestuft (Art. 5 AI Act)', en: 'Classified as prohibited practice (AI Act Art. 5)' },
  high_risk_without_evidence: { de: 'Hochrisiko ohne jeden Nachweis', en: 'High risk without any evidence' },
  missing_type: { de: 'Systemtyp fehlt', en: 'System type missing' },
  missing_deployment: { de: 'Betriebsmodell fehlt', en: 'Deployment model missing' },
  missing_residency: { de: 'Datenstandort fehlt oder unbekannt', en: 'Data residency missing or unknown' },
  missing_class: { de: 'AI-Act-Klasse nicht bestimmt', en: 'AI Act class not determined' },
  high_risk_obligations: { de: 'Hochrisiko: Pflichten nach Art. 9–15 und 26 prüfen', en: 'High risk: check obligations under Art. 9–15 and 26' },
  third_country_transfer: { de: 'Drittland ohne Angemessenheitsbeschluss: Garantien nach Art. 46 DSGVO belegen', en: 'Third country without adequacy: document Art. 46 GDPR safeguards' },
  no_owner: { de: 'Keine verantwortliche Person', en: 'No accountable owner' },
  no_evidence: { de: 'Noch kein Nachweis zu diesem System', en: 'No evidence for this system yet' },
  evidence_stale: { de: 'Jüngster Nachweis älter als 365 Tage', en: 'Latest evidence older than 365 days' },
  evidence_recent: { de: 'Angaben vollständig, Nachweis aus den letzten 365 Tagen', en: 'Data complete, evidence from the last 365 days' },
};
