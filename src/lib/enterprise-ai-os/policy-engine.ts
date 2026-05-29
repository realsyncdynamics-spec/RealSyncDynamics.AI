import type { AgentPolicy, AiRiskLevel } from './types';

export interface EvaluateAgentActionInput {
  model: string;
  dataCategories: string[];
  externalAction: boolean;
  riskLevel: AiRiskLevel;
  policy: Pick<
    AgentPolicy,
    | 'allowed_models'
    | 'forbidden_data_categories'
    | 'requires_human_approval'
    | 'external_actions_allowed'
  >;
}

export interface EvaluateAgentActionResult {
  allowed: boolean;
  requiresApproval: boolean;
  auditRequired: boolean;
  reasons: string[];
}

const PERSONAL_DATA = new Set(['personal_data', 'employee_data', 'customer_data']);
const SENSITIVE_DATA = new Set(['sensitive_data', 'health_data', 'payroll_data']);

export function evaluateAgentAction(
  input: EvaluateAgentActionInput,
): EvaluateAgentActionResult {
  const reasons: string[] = [];
  let allowed = true;
  let requiresApproval = false;
  let auditRequired = false;

  if (
    input.policy.allowed_models.length > 0 &&
    !input.policy.allowed_models.includes(input.model)
  ) {
    allowed = false;
    reasons.push(`Model ${input.model} is not allowed by policy.`);
  }

  const forbiddenMatches = input.dataCategories.filter((category) =>
    input.policy.forbidden_data_categories.includes(category),
  );

  if (forbiddenMatches.length > 0) {
    allowed = false;
    reasons.push(`Forbidden data categories detected: ${forbiddenMatches.join(', ')}.`);
  }

  if (input.externalAction && !input.policy.external_actions_allowed) {
    allowed = false;
    reasons.push('External actions are not allowed by this policy.');
  }

  if (
    input.externalAction &&
    (input.riskLevel === 'high' || input.riskLevel === 'prohibited')
  ) {
    requiresApproval = true;
    reasons.push('High/prohibited risk with external action requires approval.');
  }

  if (input.dataCategories.some((c) => PERSONAL_DATA.has(c))) {
    auditRequired = true;
    reasons.push('Personal data detected. Audit event required.');
  }

  if (input.dataCategories.some((c) => SENSITIVE_DATA.has(c))) {
    allowed = false;
    auditRequired = true;
    reasons.push('Sensitive data cannot be used for this action.');
  }

  if (input.policy.requires_human_approval) {
    requiresApproval = true;
    reasons.push('Policy requires human approval.');
  }

  return { allowed, requiresApproval, auditRequired, reasons };
}

// ---------------------------------------------------------------------------
// RuntimeEvent v0 adoption (additive)
// ---------------------------------------------------------------------------
//
// Adoption #2 aus dem RuntimeEvent-Standard-Rollout. `evaluateAgentAction()`
// laeuft pure und gibt seinen `EvaluateAgentActionResult` unveraendert
// zurueck. Konsumenten, die ein standardisiertes Runtime-Event fuer
// Logging/Telemetry/Audit-Trail brauchen, ruufen zusaetzlich diesen
// Helper auf.
//
// Wir generieren das Event NUR bei einer Violation (allowed=false). Fuer
// allowed=true gibt der Helper `null` zurueck — dann gibt es nichts zu
// reporten. So bleibt das Event-Volumen ehrlich an Verstoessen orientiert.
//
// Source: 'policy_engine'. Type: 'policy.violation_detected'. Severity:
//   - requiresApproval=true  -> 'medium' (Approval-Gate, aber kein Hard-Block)
//   - sonst                  -> 'high'   (Block ohne Approval-Pfad)
// review_status:
//   - requiresApproval=true  -> 'review_required'
//   - sonst                  -> 'not_required'
//
// Adoption #2 dokumentiert in docs/architecture/runtime-event-standard.md.

import {
  createRuntimeEvent,
  type RuntimeEvent,
} from '../../types/runtime-event';

export interface PolicyEvaluationPayloadV0 {
  /** Eingabe-Snapshot — alle Felder 1:1 aus dem Aufruf. */
  input: {
    model: string;
    dataCategories: string[];
    externalAction: boolean;
    riskLevel: AiRiskLevel;
  };
  /** Vollstaendiges Ergebnis-Objekt aus evaluateAgentAction(). */
  result: EvaluateAgentActionResult;
}

export interface PolicyEventContext {
  tenantId?: string;
  sessionId?: string;
  correlationId?: string;
}

/**
 * Verpackt das Ergebnis einer evaluateAgentAction-Auswertung in einen
 * v0-RuntimeEvent. Liefert `null`, wenn die Aktion erlaubt war — dann gibt
 * es keinen Verstoss zu protokollieren.
 *
 * Eigenschaften:
 *   - `event.spec_version === '0.1'`
 *   - `event.payload.input` enthaelt die Auswertungs-Eingabe 1:1
 *   - `event.payload.result` enthaelt das vollstaendige Ergebnis 1:1
 *   - Keine Mutation der uebergebenen Objekte
 */
export function policyResultToRuntimeEventV0(
  result: EvaluateAgentActionResult,
  input: EvaluateAgentActionInput,
  context?: PolicyEventContext,
): RuntimeEvent<PolicyEvaluationPayloadV0> | null {
  if (result.allowed) return null;

  return createRuntimeEvent<PolicyEvaluationPayloadV0>({
    spec_version: '0.1', // frozen v0 contract — see function name *ToRuntimeEventV0
    tenant_id: context?.tenantId,
    session_id: context?.sessionId,
    correlation_id: context?.correlationId,
    type: 'policy.violation_detected',
    source: 'policy_engine',
    severity: result.requiresApproval ? 'medium' : 'high',
    review_status: result.requiresApproval ? 'review_required' : 'not_required',
    actor: { type: 'agent', id: 'policy-enforcement-agent' },
    payload: {
      input: {
        model: input.model,
        dataCategories: input.dataCategories,
        externalAction: input.externalAction,
        riskLevel: input.riskLevel,
      },
      result: {
        allowed: result.allowed,
        requiresApproval: result.requiresApproval,
        auditRequired: result.auditRequired,
        reasons: result.reasons,
      },
    },
  });
}
