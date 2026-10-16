/**
 * P1 #1866 — a deterministic, read-only input model for a future KMU report.
 *
 * Sources are the existing gdpr_audits and tenant governance records, NOT a
 * new audit table and NOT browser-local scanProfile. A website scan score
 * describes only that website scan: it is NEVER an overall AI/DSGVO score.
 *
 * This module does not fetch data, authorize users or generate a PDF.
 * Callers must read through tenant-authorized RLS paths; the strict tenant
 * check below is a second defense against accidental cross-tenant joins.
 */
import type {
  DbGovernanceAsset, DbGovernancePolicy,
} from '../governanceApi';
import type { DbVendor } from '../vendorsApi';

export type FactSource = 'technical_scan' | 'tenant_registry';
export type EvidenceState = 'not_checked' | 'none_recorded' | 'recorded';
export type ReviewPriority = 'review_now' | 'follow_up';

export interface WebsiteAuditRecord {
  id: string;
  tenant_id: string;
  domain: string;
  score: number;
  created_at: string;
  issues: Array<{
    id: string;
    severity: string;
    title: string;
    paragraph_ref?: string;
  }>;
}

type SystemRow = Pick<
  DbGovernanceAsset,
  'id' | 'tenant_id' | 'asset_type' | 'name' | 'ai_act_class' |
  'status' | 'owner_email' | 'vendor' | 'intended_purpose' |
  'data_residency' | 'deployment_model' | 'model_name'
>;
type VendorRow = Pick<
  DbVendor,
  'id' | 'tenant_id' | 'name' | 'dpa_status' | 'risk_level' | 'transfer_mechanism'
>;
type PolicyRow = Pick<DbGovernancePolicy, 'id' | 'tenant_id' | 'enabled'>;

export interface SnapshotInput {
  tenantId: string;
  generatedAt: string;
  websiteAudit: WebsiteAuditRecord | null;
  assets: readonly SystemRow[];
  vendors: readonly VendorRow[];
  policies: readonly PolicyRow[];
  /** null => evidence query unavailable; empty map => queried, no records. */
  evidenceByAsset: ReadonlyMap<string, { count: number; latestAt: string | null }> | null;
}

export interface ReviewTask {
  id: string;
  code: string;
  priority: ReviewPriority;
  subjectId: string | null;
  text: string;
  source: FactSource | 'not_assessed';
}

export interface KiGovernanceSnapshot {
  kind: 'preliminary_ki_governance';
  tenantId: string;
  generatedAt: string;
  website: null | {
    auditId: string;
    domain: string;
    observedAt: string;
    websiteScanScore: number | null;
    scoreScope: 'website_only';
    source: 'technical_scan';
    findings: WebsiteAuditRecord['issues'];
  };
  aiSystems: Array<{
    id: string;
    name: string;
    aiActClass: string;
    owner: string | null;
    vendor: string | null;
    intendedPurpose: string | null;
    dataResidency: string | null;
    deploymentModel: string | null;
    model: string | null;
    status: string;
    evidenceState: EvidenceState;
    source: 'tenant_registry';
  }>;
  vendors: Array<{
    id: string;
    name: string;
    dpaStatus: DbVendor['dpa_status'];
    transferMechanism: DbVendor['transfer_mechanism'];
    riskLevel: DbVendor['risk_level'];
    source: 'tenant_registry';
  }>;
  activePolicyCount: number;
  competenceEvidence: 'not_assessed';
  shadowAiDiscovery: 'not_performed';
  reviewTasks: ReviewTask[];
  limitations: string[];
}

const meaningful = (v: string | null | undefined): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/** No legal compliance verdicts, invented scores or automatic vendor approvals. */
export function buildKiGovernanceSnapshot(input: SnapshotInput): KiGovernanceSnapshot {
  const { tenantId, websiteAudit, assets, vendors, policies, evidenceByAsset } = input;
  if (!tenantId || !Number.isFinite(Date.parse(input.generatedAt))) {
    throw new Error('Invalid tenant or report timestamp');
  }
  if (
    (websiteAudit !== null && websiteAudit.tenant_id !== tenantId) ||
    assets.some((a) => a.tenant_id !== tenantId) ||
    vendors.some((v) => v.tenant_id !== tenantId) ||
    policies.some((p) => p.tenant_id !== tenantId)
  ) {
    throw new Error('CROSS_TENANT_REPORT_INPUT');
  }

  const tasks: ReviewTask[] = [];
  const add = (code: string, subjectId: string | null, text: string, priority: ReviewPriority = 'follow_up') => {
    tasks.push({
      id: [code, subjectId ?? 'tenant'].join(':'),
      code, subjectId, text, priority,
      source: subjectId ? 'tenant_registry' : 'not_assessed',
    });
  };

  const aiAssets = assets.filter((a) => a.asset_type === 'ai_system');
  if (aiAssets.length === 0) {
    add('VERIFY_AI_INVENTORY', null, 'KI-Inventar mit den Fachbereichen abgleichen; keine automatische Shadow-AI-Erkennung durchgeführt.');
  }

  const aiSystems = aiAssets.map((a) => {
    if (!a.ai_act_class || a.ai_act_class === 'unknown') {
      add('REVIEW_AI_ACT_CLASS', a.id, 'Anwendungsfall und AI-Act-Klasse fachlich prüfen.');
    }
    if (a.ai_act_class === 'high' || a.ai_act_class === 'prohibited') {
      add('REVIEW_AI_ACT_OBLIGATIONS', a.id,
        'Mögliche Hochrisiko-/Verbotsanforderungen anhand des konkreten Einsatzzwecks prüfen.',
        'review_now');
    }
    if (!meaningful(a.owner_email)) {
      add('ASSIGN_SYSTEM_OWNER', a.id, 'Verantwortliche Person im KI-Register ergänzen.');
    }
    if (!meaningful(a.data_residency) || a.data_residency === 'unknown') {
      add('VERIFY_DATA_LOCATION', a.id, 'Datenverarbeitung und Drittlandbezug prüfen und belegen.');
    }
    const evidence = evidenceByAsset?.get(a.id);
    const evidenceState: EvidenceState = evidenceByAsset === null
      ? 'not_checked'
      : evidence && evidence.count > 0 ? 'recorded' : 'none_recorded';
    if (evidenceState === 'none_recorded') {
      add('COLLECT_SYSTEM_EVIDENCE', a.id, 'Prüfnachweise für dieses KI-System erfassen.');
    }
    return {
      id: a.id,
      name: a.name,
      aiActClass: a.ai_act_class ?? 'unknown',
      owner: meaningful(a.owner_email),
      vendor: meaningful(a.vendor),
      intendedPurpose: meaningful(a.intended_purpose),
      dataResidency: meaningful(a.data_residency),
      deploymentModel: meaningful(a.deployment_model),
      model: meaningful(a.model_name),
      status: a.status,
      evidenceState,
      source: 'tenant_registry' as const,
    };
  });

  const vendorRows = vendors.map((v) => {
    if (['none', 'requested', 'expired'].includes(v.dpa_status)) {
      add('REVIEW_VENDOR_CONTRACT', v.id,
        'Vertragsrolle und gegebenenfalls Art.-28-AVV sowie Gültigkeit prüfen.');
    }
    return {
      id: v.id, name: v.name, dpaStatus: v.dpa_status,
      transferMechanism: v.transfer_mechanism, riskLevel: v.risk_level,
      source: 'tenant_registry' as const,
    };
  });

  // There is no verified training/competence register in this input model.
  add('VERIFY_AI_COMPETENCE', null, 'Rollenbezogene KI-Kompetenzmaßnahmen und Nachweise gesondert prüfen.');

  const score = websiteAudit?.score;
  return {
    kind: 'preliminary_ki_governance',
    tenantId,
    generatedAt: input.generatedAt,
    website: websiteAudit === null ? null : {
      auditId: websiteAudit.id,
      domain: websiteAudit.domain,
      observedAt: websiteAudit.created_at,
      websiteScanScore: Number.isFinite(score) && score! >= 0 && score! <= 100 ? score! : null,
      scoreScope: 'website_only',
      source: 'technical_scan',
      findings: websiteAudit.issues,
    },
    aiSystems,
    vendors: vendorRows,
    activePolicyCount: policies.filter((p) => p.enabled).length,
    competenceEvidence: 'not_assessed',
    shadowAiDiscovery: 'not_performed',
    reviewTasks: tasks,
    limitations: [
      'Website-Messung und Selbstauskunft sind getrennte Informationsquellen.',
      'KI-System- und Anbieterangaben sind Registereinträge, keine unabhängig geprüften Tatsachen.',
      'Ein fehlender Registereintrag beweist weder das Fehlen noch das Vorhandensein eines KI-Systems.',
      'Policy-Anzahl und Nachweisanzahl begründen kein rechtliches Konformitätsurteil.',
      'Keine vollständige Shadow-AI-Erkennung, Rechtsprüfung oder zertifizierte AI-Act-Einstufung.',
    ],
  };
}
