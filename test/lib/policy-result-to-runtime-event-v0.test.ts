/**
 * Adoption #2 — policyResultToRuntimeEventV0 Vertragstest.
 *
 * Garantien:
 *   - `null` zurueck wenn result.allowed === true (kein leeres Event)
 *   - spec_version='0.1' bei Violation
 *   - .type ist 'policy.violation_detected' (valider RuntimeEventType)
 *   - severity = 'medium' bei requiresApproval, sonst 'high'
 *   - review_status = 'review_required' bei requiresApproval, sonst 'not_required'
 *   - payload.input / payload.result bewahren alle Felder 1:1
 *   - tenant_id / session_id / correlation_id werden uebernommen
 */
import { describe, it, expect } from 'vitest';
import {
  policyResultToRuntimeEventV0,
  type EvaluateAgentActionInput,
  type EvaluateAgentActionResult,
} from '../../src/lib/enterprise-ai-os/policy-engine';

const ALLOWED_INPUT: EvaluateAgentActionInput = {
  model: 'gpt-4o',
  dataCategories: ['public'],
  externalAction: false,
  riskLevel: 'minimal',
  policy: {
    allowed_models: ['gpt-4o'],
    forbidden_data_categories: [],
    requires_human_approval: false,
    external_actions_allowed: true,
  },
};

const VIOLATING_INPUT: EvaluateAgentActionInput = {
  model: 'gpt-4o',
  dataCategories: ['personal_data'],
  externalAction: true,
  riskLevel: 'high',
  policy: {
    allowed_models: ['gpt-4o'],
    forbidden_data_categories: ['personal_data'],
    requires_human_approval: false,
    external_actions_allowed: false,
  },
};

describe('policyResultToRuntimeEventV0', () => {
  it('liefert null wenn allowed=true (kein Verstoss zu reporten)', () => {
    const result: EvaluateAgentActionResult = {
      allowed: true,
      requiresApproval: false,
      auditRequired: true,
      reasons: ['ok'],
    };
    expect(policyResultToRuntimeEventV0(result, ALLOWED_INPUT)).toBeNull();
  });

  it('liefert ein v0-RuntimeEvent wenn allowed=false', () => {
    const result: EvaluateAgentActionResult = {
      allowed: false,
      requiresApproval: false,
      auditRequired: true,
      reasons: ['forbidden_data_category: personal_data', 'external_action_blocked'],
    };
    const event = policyResultToRuntimeEventV0(result, VIOLATING_INPUT);
    expect(event).not.toBeNull();
    expect(event!.spec_version).toBe('0.1');
    expect(event!.type).toBe('policy.violation_detected');
    expect(event!.source).toBe('policy_engine');
    expect(event!.actor.type).toBe('agent');
    expect(event!.actor.id).toBe('policy-enforcement-agent');
  });

  it('Severity = "high" wenn !requiresApproval (Hard-Block)', () => {
    const result: EvaluateAgentActionResult = {
      allowed: false,
      requiresApproval: false,
      auditRequired: true,
      reasons: ['blocked'],
    };
    const event = policyResultToRuntimeEventV0(result, VIOLATING_INPUT);
    expect(event!.severity).toBe('high');
    expect(event!.review_status).toBe('not_required');
  });

  it('Severity = "medium" wenn requiresApproval=true (Approval-Gate)', () => {
    const result: EvaluateAgentActionResult = {
      allowed: false,
      requiresApproval: true,
      auditRequired: true,
      reasons: ['needs human approval'],
    };
    const event = policyResultToRuntimeEventV0(result, VIOLATING_INPUT);
    expect(event!.severity).toBe('medium');
    expect(event!.review_status).toBe('review_required');
  });

  it('payload.input bewahrt model, dataCategories, externalAction, riskLevel', () => {
    const result: EvaluateAgentActionResult = {
      allowed: false, requiresApproval: false, auditRequired: true, reasons: ['x'],
    };
    const event = policyResultToRuntimeEventV0(result, VIOLATING_INPUT);
    expect(event!.payload.input.model).toBe(VIOLATING_INPUT.model);
    expect(event!.payload.input.dataCategories).toEqual(VIOLATING_INPUT.dataCategories);
    expect(event!.payload.input.externalAction).toBe(VIOLATING_INPUT.externalAction);
    expect(event!.payload.input.riskLevel).toBe(VIOLATING_INPUT.riskLevel);
    // policy-Feld wird absichtlich NICHT mit-payloaded (enthaelt Konfig,
    // nicht Telemetrie). Das ist Teil des Vertrages.
    expect((event!.payload.input as { policy?: unknown }).policy).toBeUndefined();
  });

  it('payload.result bewahrt allowed/requiresApproval/auditRequired/reasons', () => {
    const result: EvaluateAgentActionResult = {
      allowed: false,
      requiresApproval: true,
      auditRequired: true,
      reasons: ['r1', 'r2'],
    };
    const event = policyResultToRuntimeEventV0(result, VIOLATING_INPUT);
    expect(event!.payload.result).toEqual(result);
  });

  it('tenant_id / session_id / correlation_id werden aus context uebernommen', () => {
    const result: EvaluateAgentActionResult = {
      allowed: false, requiresApproval: false, auditRequired: true, reasons: ['x'],
    };
    const event = policyResultToRuntimeEventV0(result, VIOLATING_INPUT, {
      tenantId: 'tenant-42',
      sessionId: 'session-7',
      correlationId: 'corr-abc',
    });
    expect(event!.tenant_id).toBe('tenant-42');
    expect(event!.session_id).toBe('session-7');
    expect(event!.correlation_id).toBe('corr-abc');
  });

  it('mutiert die uebergebenen Objekte nicht (input + result unveraendert)', () => {
    const result: EvaluateAgentActionResult = {
      allowed: false, requiresApproval: false, auditRequired: true, reasons: ['x'],
    };
    const inputSnap   = structuredClone(VIOLATING_INPUT);
    const resultSnap  = structuredClone(result);
    policyResultToRuntimeEventV0(result, VIOLATING_INPUT);
    expect(VIOLATING_INPUT).toEqual(inputSnap);
    expect(result).toEqual(resultSnap);
  });
});
