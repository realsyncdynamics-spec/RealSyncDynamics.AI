import { describe, expect, it } from 'vitest';
import {
  FailClosedRuntimeSafetyControl,
  assessRuntimeSafetyFailClosed,
  type RuntimeSafetyAssessmentInput,
  type RuntimeSafetyControlService,
} from '../../../src/core/runtime/safety';

const input: RuntimeSafetyAssessmentInput = {
  execution_id: 'exec-1',
  tenant_id: 'tenant-1',
  agent_id: 'agent-1',
  skill_id: 'audit.cookie_scan',
  risk_level: 'low',
  capabilities: ['read:tenant.audit'],
  pii_class: 'none',
  auto_approve: true,
  input_hash: 'deadbeef',
};

describe('runtime safety control', () => {
  it('fails closed when no configured control is available', async () => {
    const result = await new FailClosedRuntimeSafetyControl().assess(input);

    expect(result).toMatchObject({
      light: 'red',
      mustStop: true,
      requiresIndependentReview: false,
      requiresHumanDecision: true,
    });
  });

  it('converts a thrown assessment into RED without exposing the error', async () => {
    const service: RuntimeSafetyControlService = {
      async assess() {
        throw new Error('secret provider detail');
      },
    };

    const result = await assessRuntimeSafetyFailClosed(service, input);

    expect(result.light).toBe('red');
    expect(result.reasons.join(' ')).not.toContain('secret provider detail');
  });

  it('converts malformed GREEN semantics into RED', async () => {
    const malformed = {
      async assess() {
        return {
          light: 'green',
          reasons: [],
          mustStop: true,
          requiresIndependentReview: false,
          requiresHumanDecision: false,
        };
      },
    } as unknown as RuntimeSafetyControlService;

    const result = await assessRuntimeSafetyFailClosed(malformed, input);

    expect(result.light).toBe('red');
    expect(result.reasons.join(' ')).toContain('invalid assessment');
  });

  it('accepts a semantically valid YELLOW assessment', async () => {
    const service: RuntimeSafetyControlService = {
      async assess() {
        return {
          light: 'yellow',
          reasons: ['Scope is uncertain.'],
          mustStop: true,
          requiresIndependentReview: true,
          requiresHumanDecision: true,
        };
      },
    };

    const result = await assessRuntimeSafetyFailClosed(service, input);

    expect(result.light).toBe('yellow');
    expect(result.requiresIndependentReview).toBe(true);
  });
});
