// Typen der Anbieter-/Deployment-Registry.
//
// Quelle der Wahrheit fuer die Dateiform ist registry/schema/*.schema.json
// (JSON Schema Draft 2020-12). Diese Typen spiegeln das Schema fuer die reinen
// Ableitungsfunktionen (residency.ts, invariants.ts) und werden von den Gates
// (scripts/registry/lib.ts) genutzt. Keine Deno-/jsr-Importe: vitest- und
// Deno-importierbar (gleiche Konvention wie _shared/evidence-hash.ts).

export type VerificationStatus = 'verified' | 'claimed' | 'unknown';

export interface SourceRef {
  url: string;
  title?: string;
  captured_at: string;
  locator?: string;
  note?: string;
}

export interface Verification {
  method: 'contract_reviewed' | 'certificate_reviewed' | 'audit_report_reviewed' | 'technical_test' | 'other';
  performed_at: string;
  performed_by: string;
  evidence_ref: string;
}

export interface FactMeta {
  status: VerificationStatus;
  sources: SourceRef[];
  captured_at: string;
  note?: string;
  verification?: Verification;
}

export interface BoolFact extends FactMeta { value: boolean | null }
export interface StringFact extends FactMeta { value: string | null }
export interface CountryListFact extends FactMeta { value: string[] }
export interface IntegerFact extends FactMeta { value: number | null }
export interface LanguagesFact extends FactMeta { value: string[]; additional_unspecified?: boolean }

export type RegionScope = 'country' | 'eu' | 'eu_efta' | 'europe' | 'global' | 'unknown';

export interface RegionFact extends FactMeta {
  scope: RegionScope;
  country_codes: string[];
  provider_region_code: string | null;
  locality: string | null;
}

export type CapabilitySupport = 'yes' | 'no' | 'partial' | 'model_dependent' | 'unknown';
export interface Capability extends FactMeta { support: CapabilitySupport }

export type CapabilityName =
  | 'chat' | 'completions' | 'json_object' | 'json_schema' | 'json_schema_strict'
  | 'tools' | 'tool_choice' | 'parallel_tool_calls' | 'streaming' | 'embeddings'
  | 'responses_api' | 'batch' | 'vision_input' | 'reasoning';

export type Capabilities = Partial<Record<CapabilityName, Capability>> & {
  context_window_tokens?: IntegerFact;
  max_output_tokens?: IntegerFact;
  languages?: LanguagesFact;
};

export interface ThirdCountryAccess {
  status: 'no_access_claimed' | 'access_possible' | 'access_confirmed' | 'unknown';
  requires_subprocessor_review: boolean;
  verification_status: VerificationStatus;
  sources: SourceRef[];
  captured_at: string;
  note?: string;
  verification?: Verification;
}

export type SealLevel = 'SEAL-0' | 'SEAL-1' | 'SEAL-2' | 'SEAL-3' | 'SEAL-4';

export interface EuCommissionSeal {
  status: 'awarded' | 'none_documented' | 'unknown';
  level: SealLevel | null;
  applies_to_sku: string[];
  verification_status: VerificationStatus;
  sources: SourceRef[];
  captured_at: string;
  valid_from: string | null;
  valid_until: string | null;
  note?: string;
  verification?: Verification;
}

export interface ControlChange {
  status: 'none' | 'signed_not_closed' | 'closed' | 'unknown';
  counterparty: string | null;
  as_of: string | null;
  verification_status: VerificationStatus;
  sources: SourceRef[];
  captured_at: string;
  note?: string;
  verification?: Verification;
}

export interface Certification {
  cert_id: string;
  scheme: string;
  name: string;
  scope: string;
  applies_to_sku: string[];
  status: VerificationStatus;
  sources: SourceRef[];
  captured_at: string;
  valid_from: string | null;
  valid_until: string | null;
  note?: string;
  verification?: Verification;
}

export interface Claim {
  claim_id: string;
  claim_type: string;
  subject: { deployment_id: string; model_ids: string[] };
  value: unknown;
  statement: string;
  status: VerificationStatus;
  sources: SourceRef[];
  captured_at: string;
  note?: string;
  verification?: Verification;
}

export interface ModelEntry {
  model_id: string;
  api_model_id: string | null;
  display_name: string;
  model_type: string;
  availability: FactMeta & { value: string };
  model_origin: FactMeta & { developer: string | null; developer_vendor_id: string | null; open_weights: boolean | null };
  inference_region?: RegionFact;
  capabilities: Capabilities;
  price_category?: FactMeta & { value: string | null };
  price?: FactMeta & { input_per_1m: number | null; output_per_1m: number | null; cached_input_per_1m?: number | null };
  note?: string;
}

export interface PricingCategory {
  category_id: string;
  display_name: string;
  kind: 'llm' | 'embedding' | 'other';
  input_per_1m: number | null;
  output_per_1m: number | null;
  sku_codes?: string[];
  sources: SourceRef[];
  captured_at: string;
}

export interface Pricing {
  scheme: 'per_model' | 'category' | 'contract_only' | 'unknown';
  currency: 'EUR' | 'USD' | null;
  unit: 'per_1m_tokens';
  vat: 'excluded' | 'included' | 'unknown';
  categories: PricingCategory[];
  modifiers: Array<{ modifier_id: string; kind: string; value: number; description: string; sources: SourceRef[]; captured_at: string }>;
  sources: SourceRef[];
  captured_at: string;
  note?: string;
}

export interface Provenance { captured_at: string; captured_by: string; research_refs: string[]; notes?: string }

export interface VendorFile {
  schema_version: '1.0';
  vendor_id: string;
  display_name: string;
  legal_name: StringFact;
  brands: string[];
  legal_seat_country: CountryListFact;
  parent_organization: StringFact;
  control_change: ControlChange;
  certifications: Certification[];
  website?: string;
  provenance: Provenance;
}

export interface DeploymentFile {
  schema_version: '1.0';
  deployment_id: string;
  vendor_id: string;
  brand: string | null;
  product_name: string;
  product_sku: string;
  deployment_kind: string;
  listing_status: 'active' | 'preview' | 'retired';
  infrastructure_operator: FactMeta & { vendor_id: string | null; name: string | null };
  connector: {
    connector_type: string;
    api_base_url: string | null;
    api_paths: string[];
    inventory_endpoint: { kind: string; path_or_url: string } | null;
    legacy_fallback_endpoint: { path_or_url: string; note?: string } | null;
    sources: SourceRef[];
    captured_at: string;
    note?: string;
  };
  inference_region: RegionFact;
  storage_region?: RegionFact;
  control_plane_region?: RegionFact;
  external_inference_egress: BoolFact;
  jurisdiction: {
    provider_jurisdiction: CountryListFact;
    infrastructure_jurisdiction: CountryListFact;
    non_eu_parent_control: BoolFact;
    eu_commission_seal: EuCommissionSeal;
    third_country_access: ThirdCountryAccess;
  };
  capabilities: Capabilities;
  certifications: Certification[];
  claims: Claim[];
  pricing: Pricing;
  models: ModelEntry[];
  provenance: Provenance;
}

export type AssessmentResult = 'PASS' | 'CONDITIONAL' | 'FAIL' | 'UNKNOWN' | 'STALE';
export type PolicyProfile = 'strict_eu_sovereignty' | 'eu_data_residency' | 'baseline';
export type AssuranceTarget = 'routing_eligibility' | 'data_residency' | 'full_supply_chain_sovereignty' | 'ai_act_documentation_support';
export type ResidencyClass = 'DE_ONLY' | 'EU_ONLY' | 'EU_EFTA' | 'GLOBAL_ALLOWED';
export type UseCaseRiskClass = 'not_assessed' | 'minimal' | 'limited' | 'high' | 'prohibited';

export interface EvidenceItem {
  ref: string;
  status: VerificationStatus;
  source_count: number;
  captured_at: string;
  max_age_days: number;
  freshness: 'fresh' | 'stale';
}

export interface AssessmentInputs {
  deployment_id: string;
  product_sku: string;
  facts: {
    inference_region: RegionFact;
    external_inference_egress: BoolFact;
    third_country_access: ThirdCountryAccess;
    eu_commission_seal: EuCommissionSeal;
  };
  evidence: EvidenceItem[];
  relied_on: string[];
  customer_config: { residency_class: ResidencyClass; settings: Record<string, unknown> };
  intended_purpose: string | null;
  use_case_risk_class: UseCaseRiskClass;
  policy_profile: PolicyProfile;
  assurance_target: AssuranceTarget;
  rule_version: string;
}

export interface AssessmentSnapshot {
  schema_version: '1.0';
  assessment_id: string;
  is_example: boolean;
  deployment_id: string;
  model_id: string | null;
  policy_profile: PolicyProfile;
  assurance_target: AssuranceTarget;
  rule_version: string;
  evaluated_at: string;
  evidence_cutoff: string;
  expires_at: string | null;
  result: AssessmentResult;
  inputs: AssessmentInputs;
  inputs_hash: string;
  inputs_hash_method: string;
  derived: {
    third_country_access: ThirdCountryAccess['status'] | null;
    seal_level: SealLevel | null;
    sovereignty_assurance: 'none' | 'data_residency' | 'full_supply_chain_sovereignty' | null;
    ai_act_conformity: 'no_statement' | 'conformant' | 'non_conformant' | null;
  };
  findings: Array<{ code: string; severity: 'info' | 'condition' | 'blocking'; message: string }>;
}

/**
 * Schnittstelle des (noch nicht gebauten) Evaluators. Er dockt hier an:
 * nimmt Fakten + Evidenz-Frische + Kundenkonfiguration + Policy-Profil +
 * Zweck + Evidence-Trail und liefert einen Snapshot, der
 * checkAssessmentInvariants() (invariants.ts) und das Evidence-Gate besteht.
 */
export interface EvaluatorInput {
  vendor: VendorFile;
  deployment: DeploymentFile;
  model_id: string | null;
  evidence: EvidenceItem[];
  customer_config: AssessmentInputs['customer_config'];
  intended_purpose: string | null;
  use_case_risk_class: UseCaseRiskClass;
  policy_profile: PolicyProfile;
  assurance_target: AssuranceTarget;
  rule_version: string;
  evidence_cutoff: string;
  /** governance_evidence.id-Werte, auf die sich der Snapshot stuetzt (Prüfpfad). */
  evidence_trail: string[];
}

export type Evaluator = (input: EvaluatorInput) => Promise<AssessmentSnapshot>;
