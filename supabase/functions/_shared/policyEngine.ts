// Governance Policy Engine — minimal evaluator v1.
//
// Given an incoming event (optionally with a linked asset) and the
// tenant's enabled policies, decide which policy applies and what
// action to take. Strictest matching action wins:
//
//     block > require_approval > warn > log > allow
//
// Condition language (JSONB on `governance_policies.condition`):
//
//   { "ai_act_class": "high" }
//   { "data_types": ["customer_data", "employee_data"] }
//   { "event_source": "agent_runtime", "vendor": "OpenAI" }
//
// - Top-level keys are AND-ed.
// - String / boolean values: equality check.
// - Array values: at-least-one overlap with the resolved field.
// - Unknown keys fall back to the event's `payload` JSON.
//
// More expressive operators ($and/$or/$gt/regex) are deferred until
// a real customer case demands them.

export type PolicyAction =
  | "allow"
  | "log"
  | "warn"
  | "block"
  | "require_approval";

const ACTION_PRECEDENCE: Record<PolicyAction, number> = {
  allow: 0,
  log: 1,
  warn: 2,
  require_approval: 3,
  block: 4,
};

export interface PolicyRow {
  id: string;
  tenant_id: string | null;
  policy_type: string;
  severity: string;
  action: PolicyAction;
  condition: Record<string, unknown>;
  enabled: boolean;
}

export interface EventForEval {
  event_type: string;
  event_source: string;
  vendor?: string | null;
  model_name?: string | null;
  data_types?: string[];
  risk_level?: string;
  payload?: Record<string, unknown>;
}

export interface AssetForEval {
  id: string;
  asset_type: string;
  ai_act_class: string;
  data_types?: string[];
  vendor?: string | null;
}

export interface PolicyDecision {
  policy_id: string;
  action: PolicyAction;
}

const DIRECT_EVENT_FIELDS = new Set([
  "event_type",
  "event_source",
  "vendor",
  "model_name",
  "data_types",
  "risk_level",
]);

const ASSET_FIELDS = new Set(["asset_type", "ai_act_class"]);

function getValue(
  event: EventForEval,
  asset: AssetForEval | null,
  key: string,
): unknown {
  if (DIRECT_EVENT_FIELDS.has(key)) {
    return (event as unknown as Record<string, unknown>)[key];
  }
  if (ASSET_FIELDS.has(key) && asset) {
    return (asset as unknown as Record<string, unknown>)[key];
  }
  return event.payload?.[key];
}

function matchValue(expected: unknown, actual: unknown): boolean {
  if (expected === null || expected === undefined) {
    return actual === expected;
  }
  if (Array.isArray(expected)) {
    if (Array.isArray(actual)) {
      return expected.some((e) => actual.includes(e));
    }
    return expected.includes(actual);
  }
  return expected === actual;
}

function policyMatches(
  policy: PolicyRow,
  event: EventForEval,
  asset: AssetForEval | null,
): boolean {
  if (!policy.enabled) return false;
  const cond = policy.condition ?? {};
  for (const [k, v] of Object.entries(cond)) {
    const actual = getValue(event, asset, k);
    if (!matchValue(v, actual)) return false;
  }
  return true;
}

/**
 * Evaluate all policies against a single event. Returns the
 * strictest matching policy, or null if none match.
 */
export function evaluatePolicies(
  event: EventForEval,
  asset: AssetForEval | null,
  policies: PolicyRow[],
): PolicyDecision | null {
  let best: PolicyDecision | null = null;
  for (const p of policies) {
    if (!policyMatches(p, event, asset)) continue;
    const decision: PolicyDecision = { policy_id: p.id, action: p.action };
    if (
      !best ||
      ACTION_PRECEDENCE[decision.action] > ACTION_PRECEDENCE[best.action]
    ) {
      best = decision;
    }
  }
  return best;
}
