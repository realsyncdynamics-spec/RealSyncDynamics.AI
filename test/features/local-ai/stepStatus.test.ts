import { describe, it, expect } from 'vitest';
import {
  INITIAL_FLOW_STATE,
  deriveStepStatuses,
  canRunTest,
  canActivate,
  canStartLoop,
  type OnboardingFlowState,
} from '@/src/features/local-ai/stepStatus';
import { LOCAL_AI_ROLES, isRoleUnlocked, isModelInstalled } from '@/src/features/local-ai/roles';
import type { GovernanceTestResult } from '@/src/features/local-ai/types';

const reachable = (models: string[]): OnboardingFlowState['probe'] => ({
  ok: true,
  data: { runtimeUrl: 'http://127.0.0.1:11434', models, latencyMs: 12, checkedAt: '2026-09-28T10:00:00Z' },
});

const testResult = (overall: GovernanceTestResult['overall'], model = 'granite4.2:8b'): OnboardingFlowState['test'] => ({
  ok: true,
  data: { overall, model, checks: [], rawOutput: '{}', durationMs: 5, ranAt: '2026-09-28T10:01:00Z' },
});

describe('deriveStepStatuses', () => {
  it('starts with every step pending', () => {
    expect(Object.values(deriveStepStatuses(INITIAL_FLOW_STATE))).toEqual(Array(6).fill('pending'));
  });

  it('shows checking while probing', () => {
    const s = deriveStepStatuses({ ...INITIAL_FLOW_STATE, probing: true });
    expect(s.install).toBe('checking');
    expect(s.connection).toBe('checking');
  });

  it('maps the four connection outcomes', () => {
    const ok = deriveStepStatuses({ ...INITIAL_FLOW_STATE, probe: reachable(['granite4.2:8b']) });
    expect([ok.install, ok.connection]).toEqual(['success', 'success']);
    const noModels = deriveStepStatuses({ ...INITIAL_FLOW_STATE, probe: reachable([]) });
    expect([noModels.install, noModels.connection]).toEqual(['success', 'warning']);
    const cors = deriveStepStatuses({ ...INITIAL_FLOW_STATE, probe: { ok: false, error: { code: 'CORS_BLOCKED', message: '' } } });
    expect([cors.install, cors.connection]).toEqual(['warning', 'failed']);
    const down = deriveStepStatuses({ ...INITIAL_FLOW_STATE, probe: { ok: false, error: { code: 'RUNTIME_UNREACHABLE', message: '' } } });
    expect([down.install, down.connection]).toEqual(['failed', 'failed']);
  });

  it('warns when the chosen model is not installed', () => {
    const s = { ...INITIAL_FLOW_STATE, probe: reachable(['llama3:latest']), role: 'governance' as const, model: 'granite4.2:8b' };
    expect(deriveStepStatuses(s).role).toBe('warning');
    expect(canRunTest(s)).toBe(false);
  });

  it('gates the test and activation on real results only', () => {
    const base = { ...INITIAL_FLOW_STATE, probe: reachable(['granite4.2:8b']), role: 'governance' as const, model: 'granite4.2:8b' };
    expect(canRunTest(base)).toBe(true);
    expect(canActivate(base)).toBe(false);
    expect(canActivate({ ...base, test: testResult('warning') })).toBe(false);
    expect(canActivate({ ...base, test: testResult('success') })).toBe(true);
    // Test eines anderen Modells zählt nicht
    const stale = { ...base, test: testResult('success', 'other') };
    expect(deriveStepStatuses(stale).governance_test).toBe('pending');
    expect(canActivate(stale)).toBe(false);
    expect(deriveStepStatuses({ ...base, test: { ok: false, error: { code: 'TIMEOUT', message: '' } } }).governance_test).toBe('failed');
  });

  it('only allows the loop for an enabled profile and reflects snapshots', () => {
    expect(canStartLoop(INITIAL_FLOW_STATE)).toBe(false);
    const snap = { checkedAt: 'x', runtimeReachable: true, modelReachable: false, latencyMs: 3, errorCode: 'MODEL_NOT_INSTALLED' as const };
    expect(deriveStepStatuses({ ...INITIAL_FLOW_STATE, loopRunning: true, loopSnapshot: snap }).loop).toBe('warning');
    expect(deriveStepStatuses({ ...INITIAL_FLOW_STATE, loopRunning: true, loopSnapshot: { ...snap, runtimeReachable: false } }).loop).toBe('failed');
    expect(deriveStepStatuses({ ...INITIAL_FLOW_STATE, loopRunning: true, loopSnapshot: { ...snap, modelReachable: true, errorCode: null } }).loop).toBe('success');
  });
});

describe('roles', () => {
  it('maps roles to the recommended models', () => {
    expect(Object.fromEntries(LOCAL_AI_ROLES.map((r) => [r.id, r.recommendedModel]))).toEqual({
      governance: 'granite4.2:8b',
      coding: 'qwen3.8:27b',
      vision: 'glm-5.3-flash',
      persistent: 'muse-glimmer',
    });
  });

  it('locks the persistent agent until the base test passed', () => {
    const persistent = LOCAL_AI_ROLES.find((r) => r.id === 'persistent')!;
    expect(isRoleUnlocked(persistent, null)).toBe(false);
    expect(isRoleUnlocked(persistent, { overall: 'warning', model: 'm', checks: [], ranAt: '' })).toBe(false);
    expect(isRoleUnlocked(persistent, { overall: 'success', model: 'm', checks: [], ranAt: '' })).toBe(true);
  });

  it('treats :latest tags as installed', () => {
    expect(isModelInstalled('muse-glimmer', ['muse-glimmer:latest'])).toBe(true);
    expect(isModelInstalled('granite4.2:8b', ['granite4.2:2b'])).toBe(false);
  });
});
