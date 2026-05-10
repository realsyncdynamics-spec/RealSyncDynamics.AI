/**
 * Policy-Engine — wertet Runtime-AI-Events gegen aktive Policies aus und
 * liefert ein Verdict (allow / warn / block / require_approval / logged).
 *
 * Pure-ESM-TypeScript ohne externe Imports — laeuft in Deno (Edge-Function
 * `telemetry-ai-event`) und in Vitest-Unit-Tests gleichzeitig.
 *
 * Algorithmus:
 *   1. Filter: nur enabled Policies des Tenants (oder global, tenant_id=null)
 *   2. Pro Policy: matchPolicy(event, policy) -> bool
 *   3. Bei Match: Action sammeln
 *   4. Verdict: schaerfste Action gewinnt (Block > Approval > Warn > Log > Allow)
 *
 * Rule-Types in dieser PR:
 *   data_transfer       → blockt/warnt PII zu externen Vendoren
 *   model_usage         → restringiert spezifische Vendor/Model-Kombis
 *   human_review        → fordert Approval bei high-risk AI-Output
 *   logging_required    → erzwingt log-only fuer Agent-Actions
 *   vendor_restriction  → allow/block-Listen pro Vendor
 *
 * Conditions sind JSONB-Objekte. Schema pro rule_type siehe RuleConditions
 * unten.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type AiEventType =
  | 'prompt_sent'
  | 'response_received'
  | 'agent_action'
  | 'file_upload'
  | 'tool_call'
  | 'session_start'
  | 'session_end';

export type AiPromptCategory =
  | 'code_generation'
  | 'content_generation'
  | 'classification'
  | 'summarization'
  | 'translation'
  | 'extraction'
  | 'agent_action'
  | 'analysis'
  | 'qa'
  | 'unknown';

export type AiDataClass =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'personal_data'
  | 'special_category'
  | 'unknown';

export type AiRiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type PolicyAction =
  | 'allow'
  | 'warn'
  | 'block'
  | 'require_approval';

export type PolicyStatus =
  | 'allowed'
  | 'warned'
  | 'blocked'
  | 'requires_approval'
  | 'logged';

export type RuleType =
  | 'data_transfer'
  | 'model_usage'
  | 'human_review'
  | 'logging_required'
  | 'vendor_restriction';

export interface RuntimeEventInput {
  vendor?: string;
  model?: string;
  event_type: AiEventType;
  prompt_category?: AiPromptCategory;
  data_class?: AiDataClass;
  risk_level?: AiRiskLevel;
  ai_system_id?: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  rule_type: RuleType;
  action: PolicyAction;
  enabled: boolean;
  /** JSONB-Bedingung; Schema haengt von rule_type ab. */
  condition: RuleConditions;
}

/**
 * Condition-Schemata pro RuleType. Optionale Felder sind "nicht eingeschraenkt".
 * Leere Condition matched alle Events des Tenants — daher in der UI vor
 * Aktivierung warnen.
 */
export type RuleConditions =
  | DataTransferCondition
  | ModelUsageCondition
  | HumanReviewCondition
  | LoggingRequiredCondition
  | VendorRestrictionCondition
  | Record<string, never>; // erlaubt {} fuer "match all"

export interface DataTransferCondition {
  /** Welche Datenklassen triggern diese Regel? z.B. ['personal_data', 'special_category'] */
  data_classes?: AiDataClass[];
  /** True = nur extern (OpenAI/Anthropic/Google/Perplexity), False = nur intern, undefined = beides */
  to_external_vendor?: boolean;
}

export interface ModelUsageCondition {
  vendors?: string[];
  models?: string[];
  event_types?: AiEventType[];
}

export interface HumanReviewCondition {
  risk_levels?: AiRiskLevel[];
  prompt_categories?: AiPromptCategory[];
}

export interface LoggingRequiredCondition {
  event_types?: AiEventType[];
}

export interface VendorRestrictionCondition {
  /** Liste blockierter Vendoren (Block + Match). */
  blocked_vendors?: string[];
  /** Allow-Liste — Events von Vendoren NICHT in der Liste werden als Match gewertet. */
  allowed_vendors?: string[];
}

export interface PolicyVerdict {
  status: PolicyStatus;
  /** ID der ausschlaggebenden Policy. Bei mehreren Matches: die schaerfste. */
  matched_policy_id?: string;
  /** Alle gematchten Policies (z.B. fuer Audit-Log). */
  matched_policy_ids: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXTERNAL_VENDORS = new Set(['openai', 'anthropic', 'google', 'perplexity']);

function isExternalVendor(vendor?: string): boolean {
  if (!vendor) return false;
  return EXTERNAL_VENDORS.has(vendor.toLowerCase());
}

// Action-Schaerfe-Ordnung (hoeherer Wert = schaerfer):
const ACTION_SEVERITY: Record<PolicyAction, number> = {
  allow: 0,
  warn: 1,
  require_approval: 2,
  block: 3,
};

const ACTION_TO_STATUS: Record<PolicyAction, PolicyStatus> = {
  allow: 'allowed',
  warn: 'warned',
  require_approval: 'requires_approval',
  block: 'blocked',
};

// ─── Match per RuleType ──────────────────────────────────────────────────────

function matchDataTransfer(event: RuntimeEventInput, c: DataTransferCondition): boolean {
  if (c.data_classes && c.data_classes.length > 0) {
    if (!event.data_class || !c.data_classes.includes(event.data_class)) return false;
  }
  if (c.to_external_vendor !== undefined) {
    const ext = isExternalVendor(event.vendor);
    if (c.to_external_vendor && !ext) return false;
    if (!c.to_external_vendor && ext) return false;
  }
  return true;
}

function matchModelUsage(event: RuntimeEventInput, c: ModelUsageCondition): boolean {
  if (c.vendors && c.vendors.length > 0) {
    if (!event.vendor || !c.vendors.includes(event.vendor.toLowerCase())) return false;
  }
  if (c.models && c.models.length > 0) {
    if (!event.model || !c.models.includes(event.model)) return false;
  }
  if (c.event_types && c.event_types.length > 0) {
    if (!c.event_types.includes(event.event_type)) return false;
  }
  return true;
}

function matchHumanReview(event: RuntimeEventInput, c: HumanReviewCondition): boolean {
  if (c.risk_levels && c.risk_levels.length > 0) {
    if (!event.risk_level || !c.risk_levels.includes(event.risk_level)) return false;
  }
  if (c.prompt_categories && c.prompt_categories.length > 0) {
    if (!event.prompt_category || !c.prompt_categories.includes(event.prompt_category)) return false;
  }
  return true;
}

function matchLoggingRequired(event: RuntimeEventInput, c: LoggingRequiredCondition): boolean {
  if (c.event_types && c.event_types.length > 0) {
    return c.event_types.includes(event.event_type);
  }
  return true;
}

function matchVendorRestriction(event: RuntimeEventInput, c: VendorRestrictionCondition): boolean {
  const v = event.vendor?.toLowerCase();
  if (!v) return false;
  if (c.blocked_vendors && c.blocked_vendors.length > 0) {
    return c.blocked_vendors.includes(v);
  }
  if (c.allowed_vendors && c.allowed_vendors.length > 0) {
    return !c.allowed_vendors.includes(v);
  }
  return false;
}

export function matchPolicy(event: RuntimeEventInput, policy: PolicyRule): boolean {
  if (!policy.enabled) return false;
  switch (policy.rule_type) {
    case 'data_transfer':
      return matchDataTransfer(event, policy.condition as DataTransferCondition);
    case 'model_usage':
      return matchModelUsage(event, policy.condition as ModelUsageCondition);
    case 'human_review':
      return matchHumanReview(event, policy.condition as HumanReviewCondition);
    case 'logging_required':
      return matchLoggingRequired(event, policy.condition as LoggingRequiredCondition);
    case 'vendor_restriction':
      return matchVendorRestriction(event, policy.condition as VendorRestrictionCondition);
    default:
      return false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluiert ein Event gegen eine Policy-Liste und liefert das Verdict.
 *
 * Wenn keine Policy matched: status='logged', kein matched_policy_id.
 * Bei mehreren Matches: schaerfste Action gewinnt; matched_policy_id zeigt
 * auf die schaerfste, matched_policy_ids enthaelt alle.
 */
export function evaluatePolicies(
  event: RuntimeEventInput,
  policies: PolicyRule[],
): PolicyVerdict {
  const matched: PolicyRule[] = [];
  for (const p of policies) {
    if (matchPolicy(event, p)) matched.push(p);
  }

  if (matched.length === 0) {
    return { status: 'logged', matched_policy_ids: [] };
  }

  // Sortieren nach Schaerfe absteigend; Tie-Break: erste in Liste
  const sorted = [...matched].sort(
    (a, b) => ACTION_SEVERITY[b.action] - ACTION_SEVERITY[a.action],
  );
  const winner = sorted[0];

  return {
    status: ACTION_TO_STATUS[winner.action],
    matched_policy_id: winner.id,
    matched_policy_ids: sorted.map((p) => p.id),
  };
}
