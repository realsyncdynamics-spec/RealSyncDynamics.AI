import { describe, it, expect } from 'vitest';
import {
  RemediatorRegistry,
  type DeliveryResult,
  type Remediation,
  type RemediationAction,
  type Remediator,
} from '../../../src/core/runtime/remediation';

function fakeRemediation(
  overrides: Partial<Remediation> = {},
  action: RemediationAction = {
    kind: 'remove_tracker',
    tracker: 'googletagmanager',
    selector: 'script[src*="googletagmanager.com"]',
  },
): Remediation {
  return {
    id: 'rem_1',
    tenant_id: 'tenant_1',
    problem: {
      governance_event: 'tracker.pre_consent.detected',
      severity: 'high',
      risk_level: 'high',
      target: 'kunde-1.de',
      description: 'Pre-consent tracker detected.',
    },
    action,
    delivery: 'cms_patch',
    status: 'drafted',
    fingerprint: 'f'.repeat(64),
    drafted_at: '2026-05-16T03:22:11Z',
    ...overrides,
  };
}

class FakeCmsPatcher implements Remediator {
  readonly channel = 'cms_patch' as const;
  readonly calls: Remediation[] = [];
  supports(action: RemediationAction): boolean {
    return action.kind === 'remove_tracker' || action.kind === 'inject_consent_sdk';
  }
  async deliver(remediation: Remediation): Promise<DeliveryResult> {
    this.calls.push(remediation);
    return { ok: true, external_id: `patch_${remediation.id}` };
  }
}

class FakeWebhookDispatcher implements Remediator {
  readonly channel = 'webhook' as const;
  supports(action: RemediationAction): boolean {
    return action.kind === 'notify_human';
  }
  async deliver(): Promise<DeliveryResult> {
    return { ok: true };
  }
}

describe('RemediatorRegistry', () => {
  it('resolves by channel', () => {
    const reg = new RemediatorRegistry();
    const patcher = new FakeCmsPatcher();
    reg.register(patcher);
    expect(reg.resolve('cms_patch')).toBe(patcher);
    expect(reg.resolve('webhook')).toBeUndefined();
  });

  it('refuses duplicate channel registration', () => {
    const reg = new RemediatorRegistry();
    reg.register(new FakeCmsPatcher());
    expect(() => reg.register(new FakeCmsPatcher())).toThrow(/already registered/);
  });

  it('picks the first remediator that supports an action', () => {
    const reg = new RemediatorRegistry();
    const patcher = new FakeCmsPatcher();
    const webhook = new FakeWebhookDispatcher();
    reg.register(patcher);
    reg.register(webhook);

    expect(
      reg.pickFor({
        kind: 'remove_tracker',
        tracker: 'gtm',
        selector: 'script',
      }),
    ).toBe(patcher);
    expect(reg.pickFor({ kind: 'notify_human', reason: 'unknown vendor' })).toBe(
      webhook,
    );
    expect(reg.pickFor({ kind: 'add_dpa_record', vendor: 'plausible' })).toBeUndefined();
  });

  it('delivers a remediation through the resolved remediator', async () => {
    const reg = new RemediatorRegistry();
    const patcher = new FakeCmsPatcher();
    reg.register(patcher);

    const remediation = fakeRemediation({ status: 'approved' });
    const remediator = reg.resolve(remediation.delivery)!;
    const result = await remediator.deliver(remediation);

    expect(result.ok).toBe(true);
    expect(result.external_id).toBe('patch_rem_1');
    expect(patcher.calls).toHaveLength(1);
    expect(patcher.calls[0].id).toBe('rem_1');
  });
});
