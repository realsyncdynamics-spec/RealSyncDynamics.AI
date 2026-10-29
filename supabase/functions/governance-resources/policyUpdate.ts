/**
 * Validierung und Durchsetzbarkeits-Prüfung (`verdictIsHonest`) für
 * `op: 'update_policy'` in `governance-resources`.
 *
 * Hält die Zuordnung `system_type → EnforcementClass` und die zulässigen
 * Verdikte je Klasse synchron zu `shared/enforcement-classes.ts` und
 * `connector_enforcement_class()` in SQL (P2-1).
 */

export type EnforcementClass = 'A' | 'B' | 'C' | 'D';
export type Verdict = 'allow' | 'log_only' | 'warn' | 'block' | 'require_approval' | 'react';
export type PolicyAction = 'allow' | 'log' | 'warn' | 'block' | 'require_approval';

const CLASS_A_SYSTEMS = new Set([
  'ai_gateway',
  'agent_runtime',
  'sdk_preflight',
  'chatbot',
  'whatsapp',
  'voice',
]);

const CLASS_B_SYSTEMS = new Set([
  'siteos_publish',
  'cicd_gate',
]);

const CLASS_D_SYSTEMS = new Set([
  'browser_direct',
]);

const HONEST_VERDICTS: Readonly<Record<EnforcementClass, ReadonlySet<Verdict>>> = {
  A: new Set<Verdict>(['allow', 'log_only', 'warn', 'block', 'require_approval']),
  B: new Set<Verdict>(['allow', 'log_only', 'warn', 'block', 'require_approval']),
  C: new Set<Verdict>(['log_only', 'warn', 'react']),
  D: new Set<Verdict>(['log_only']),
};

export const VALID_POLICY_ACTIONS: readonly PolicyAction[] = [
  'allow',
  'log',
  'warn',
  'block',
  'require_approval',
];

export function enforcementClassOf(systemType: string): EnforcementClass {
  const key = (systemType ?? '').trim();
  if (CLASS_A_SYSTEMS.has(key)) return 'A';
  if (CLASS_B_SYSTEMS.has(key)) return 'B';
  if (CLASS_D_SYSTEMS.has(key)) return 'D';
  return 'C';
}

export function verdictIsHonest(klasse: EnforcementClass, verdict: Verdict): boolean {
  return HONEST_VERDICTS[klasse].has(verdict);
}

export function verdictOfAction(action: PolicyAction): Verdict {
  return action === 'log' ? 'log_only' : action;
}

export function normalizePolicyAction(raw: unknown): PolicyAction | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === 'log_only') return 'log';
  if ((VALID_POLICY_ACTIONS as readonly string[]).includes(trimmed)) {
    return trimmed as PolicyAction;
  }
  return null;
}

export function derivePolicyEnforcementClass(
  condition: Record<string, unknown> | null | undefined,
): EnforcementClass {
  if (!condition || typeof condition !== 'object') return enforcementClassOf('');
  const rawSystemType = condition.system_type;
  if (typeof rawSystemType === 'string' && rawSystemType.trim().length > 0) {
    return enforcementClassOf(rawSystemType.trim());
  }
  const rawEventSource = condition.event_source;
  if (typeof rawEventSource === 'string' && rawEventSource.trim().length > 0) {
    return enforcementClassOf(rawEventSource.trim());
  }
  return enforcementClassOf('');
}

export interface PolicyUpdateValidationInput {
  action?: unknown;
  enabled?: unknown;
}

export type PolicyUpdateValidationResult =
  | {
      ok: true;
      patch: {
        action?: PolicyAction;
        enforce_action?: PolicyAction;
        enabled?: boolean;
      };
      klasse: EnforcementClass;
      verdict?: Verdict;
    }
  | {
      ok: false;
      status: 400 | 422;
      code: 'BAD_REQUEST' | 'UNHONEST_VERDICT';
      message: string;
    };

export function validatePolicyUpdate(
  input: PolicyUpdateValidationInput,
  existingCondition: Record<string, unknown> | null | undefined,
): PolicyUpdateValidationResult {
  const hasAction = input.action !== undefined;
  const hasEnabled = input.enabled !== undefined;

  if (!hasAction && !hasEnabled) {
    return {
      ok: false,
      status: 400,
      code: 'BAD_REQUEST',
      message: 'action or enabled required',
    };
  }

  const klasse = derivePolicyEnforcementClass(existingCondition);
  const patch: {
    action?: PolicyAction;
    enforce_action?: PolicyAction;
    enabled?: boolean;
  } = {};
  let verdict: Verdict | undefined;

  if (hasEnabled) {
    if (typeof input.enabled !== 'boolean') {
      return {
        ok: false,
        status: 400,
        code: 'BAD_REQUEST',
        message: 'enabled boolean required',
      };
    }
    patch.enabled = input.enabled;
  }

  if (hasAction) {
    const normalized = normalizePolicyAction(input.action);
    if (!normalized) {
      return {
        ok: false,
        status: 400,
        code: 'BAD_REQUEST',
        message: `action must be one of ${VALID_POLICY_ACTIONS.join('|')}`,
      };
    }
    verdict = verdictOfAction(normalized);
    if (!verdictIsHonest(klasse, verdict)) {
      return {
        ok: false,
        status: 422,
        code: 'UNHONEST_VERDICT',
        message: `Verdikt "${verdict}" ist für Durchsetzungsklasse ${klasse} nicht einlösbar.`,
      };
    }
    patch.action = normalized;
    patch.enforce_action = normalized;
  }

  return { ok: true, patch, klasse, verdict };
}
