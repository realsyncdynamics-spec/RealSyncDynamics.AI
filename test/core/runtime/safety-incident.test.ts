import { describe, expect, it, vi } from 'vitest';
import {
  SafetyIncidentController,
  type EmergencySafetyExecutor,
} from '../../../src/core/runtime/safety-incident';
import type { RedEmergencyAction } from '../../../src/lib/enterprise-ai-os/safety-control-plane';

const H = (char: string) => char.repeat(64);

function completeRecovery() {
  return {
    rootCauseIdentified: true,
    remediationApplied: true,
    independentSafetyReviewComplete: true,
    verificationPassed: true,
    regressionTestsPassed: true,
    permissionsRevalidated: true,
    residualRiskDocumented: true,
    humanRestartApproval: true,
    restartAtReducedAutonomy: true,
  };
}

function makeClock() {
  let n = 0;
  return () => new Date(`2026-10-07T02:00:${String(n++).padStart(2, '0')}.000Z`);
}

describe('SafetyIncidentController', () => {
  it('always executes the required bounded protective actions on RED', async () => {
    const seen: RedEmergencyAction[] = [];
    const executor: EmergencySafetyExecutor = {
      async execute(action) {
        seen.push(action);
        return { ok: true, evidenceRef: `evidence://${action}` };
      },
    };

    const controller = new SafetyIncidentController(executor, {
      id: () => 'incident-1',
      clock: makeClock(),
    });

    const incident = await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
    });

    expect(seen).toEqual([
      'pause_workflow',
      'block_new_executions',
      'disable_write_operations',
      'preserve_logs',
      'preserve_evidence',
      'create_incident_snapshot',
      'notify_human',
    ]);
    expect(incident.state).toBe('recovery_required');
    expect(controller.canStartNewAutomationRequest('incident-1')).toBe(false);
  });

  it('rejects non-safety actions but still runs the mandatory protective plan', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const controller = new SafetyIncidentController({ execute }, {
      id: () => 'incident-1',
      clock: makeClock(),
    });

    const incident = await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
      requestedEmergencyActions: [
        'deploy_fix',
        'delete_customer_data',
        'isolate_session',
      ],
    });

    expect(incident.rejectedRequestedActions).toEqual([
      'deploy_fix',
      'delete_customer_data',
    ]);
    expect(execute).not.toHaveBeenCalledWith(
      'deploy_fix',
      expect.anything(),
    );
    expect(execute).not.toHaveBeenCalledWith(
      'delete_customer_data',
      expect.anything(),
    );
    expect(execute).toHaveBeenCalledWith(
      'isolate_session',
      expect.objectContaining({ incidentId: 'incident-1' }),
    );
    expect(execute).toHaveBeenCalledWith(
      'notify_human',
      expect.objectContaining({ incidentId: 'incident-1' }),
    );
  });

  it('continues remaining protective actions when one emergency action fails', async () => {
    const seen: RedEmergencyAction[] = [];
    const executor: EmergencySafetyExecutor = {
      async execute(action) {
        seen.push(action);
        if (action === 'disable_write_operations') {
          throw new Error('sensitive infrastructure detail');
        }
        return { ok: true };
      },
    };

    const controller = new SafetyIncidentController(executor, {
      id: () => 'incident-1',
      clock: makeClock(),
    });

    const incident = await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
    });

    expect(seen).toContain('preserve_evidence');
    expect(seen).toContain('notify_human');

    const failed = incident.emergencyActions.find(
      (item) => item.action === 'disable_write_operations',
    );
    expect(failed).toMatchObject({
      ok: false,
      errorCode: 'emergency_action_failed',
    });
    expect(JSON.stringify(incident)).not.toContain('sensitive infrastructure detail');
  });

  it('is idempotent for repeated RED signals on the same execution', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    let nextId = 0;
    const controller = new SafetyIncidentController({ execute }, {
      id: () => `incident-${++nextId}`,
      clock: makeClock(),
    });

    const first = await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
    });
    const callsAfterFirst = execute.mock.calls.length;

    const second = await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
      requestedEmergencyActions: ['isolate_session'],
    });

    expect(second.incidentId).toBe(first.incidentId);
    expect(execute).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('does not permit a new automation request while recovery evidence is incomplete', async () => {
    const controller = new SafetyIncidentController(
      { async execute() { return { ok: true }; } },
      { id: () => 'incident-1', clock: makeClock() },
    );

    await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
    });

    const result = controller.evaluateRecovery('incident-1', {
      ...completeRecovery(),
      humanRestartApproval: false,
      regressionTestsPassed: false,
    });

    expect(result.newAutomationRequestAllowed).toBe(false);
    expect(result.incident.state).toBe('recovery_required');
    expect(result.decision.missing).toEqual(
      expect.arrayContaining(['humanRestartApproval', 'regressionTestsPassed']),
    );
  });

  it('moves only to reduced autonomy after complete recovery and human restart approval', async () => {
    const controller = new SafetyIncidentController(
      { async execute() { return { ok: true }; } },
      { id: () => 'incident-1', clock: makeClock() },
    );

    await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
    });

    const result = controller.evaluateRecovery('incident-1', completeRecovery());

    expect(result.decision.eligibleForNewAutomationRequest).toBe(true);
    expect(result.newAutomationRequestAllowed).toBe(true);
    expect(result.incident.state).toBe('reduced_autonomy');
    expect(controller.canStartNewAutomationRequest('incident-1')).toBe(true);
  });

  it('has no API that silently restores the previous automation mode', async () => {
    const controller = new SafetyIncidentController(
      { async execute() { return { ok: true }; } },
      { id: () => 'incident-1', clock: makeClock() },
    );

    await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
    });
    controller.evaluateRecovery('incident-1', completeRecovery());

    expect('reset' in controller).toBe(false);
    expect('resume' in controller).toBe(false);
    expect('activate' in controller).toBe(false);
  });
});


describe('SafetyIncidentController — incident binding hardening', () => {
  it('never aliases the same execution id across tenants', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    let nextId = 0;
    const controller = new SafetyIncidentController({ execute }, {
      id: () => `incident-${++nextId}`,
      clock: makeClock(),
    });

    const first = await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'shared-exec-id',
      evidenceHash: H('a'),
    });
    const second = await controller.openRedIncident({
      tenantId: 'tenant-2',
      executionId: 'shared-exec-id',
      evidenceHash: H('b'),
    });

    expect(first.incidentId).not.toBe(second.incidentId);
    expect(first.tenantId).toBe('tenant-1');
    expect(second.tenantId).toBe('tenant-2');
  });

  it('rejects a repeated RED signal when the frozen evidence hash changes', async () => {
    const controller = new SafetyIncidentController(
      { async execute() { return { ok: true }; } },
      { id: () => 'incident-1', clock: makeClock() },
    );

    await controller.openRedIncident({
      tenantId: 'tenant-1',
      executionId: 'exec-1',
      evidenceHash: H('a'),
    });

    await expect(
      controller.openRedIncident({
        tenantId: 'tenant-1',
        executionId: 'exec-1',
        evidenceHash: H('b'),
      }),
    ).rejects.toThrow(/different evidence hash/i);
  });
});
