import { describe, it, expect } from 'vitest';
import {
  validateGovernanceEvent,
  assertValidGovernanceEvent,
  GovernanceEventValidationError,
  toRuntimeEvent,
  type GovernanceEvent,
  type TrackerPreConsentDetected,
  type EvidenceSealed,
} from '../../../src/core/runtime/governanceEvents';

const VALID_HASH = 'a'.repeat(64);

function trackerEvent(
  overrides: Partial<TrackerPreConsentDetected> = {},
): TrackerPreConsentDetected {
  return {
    name: 'tracker.pre_consent.detected',
    tenant_id: 'tenant_1',
    severity: 'high',
    actor: { source: 'browser_collector', id: 'collector_eu_1' },
    target: 'kunde-1.de',
    occurred_at: '2026-05-16T03:22:11Z',
    payload: {
      tracker: 'googletagmanager',
      request_url: 'https://www.googletagmanager.com/gtag/js?id=G-xxx',
      consent_state: 'no_banner',
    },
    ...overrides,
  } as TrackerPreConsentDetected;
}

describe('validateGovernanceEvent', () => {
  it('accepts a well-formed event', () => {
    expect(validateGovernanceEvent(trackerEvent())).toEqual([]);
  });

  it('requires tenant_id, target, actor.id', () => {
    const errs = validateGovernanceEvent(
      trackerEvent({
        tenant_id: '',
        target: '',
        actor: { source: 'browser_collector', id: '' },
      }),
    );
    const paths = errs.map((e) => e.path);
    expect(paths).toContain('tenant_id');
    expect(paths).toContain('target');
    expect(paths).toContain('actor.id');
  });

  it('rejects unknown name, severity and actor.source', () => {
    const errs = validateGovernanceEvent({
      ...trackerEvent(),
      name: 'tracker.bogus' as TrackerPreConsentDetected['name'],
      severity: 'panic' as TrackerPreConsentDetected['severity'],
      actor: {
        source: 'rogue_satellite' as TrackerPreConsentDetected['actor']['source'],
        id: 'x',
      },
    });
    const paths = errs.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'severity', 'actor.source']));
  });

  it('rejects non-ISO-8601 occurred_at', () => {
    const errs = validateGovernanceEvent(trackerEvent({ occurred_at: '2026/05/16' }));
    expect(errs.some((e) => e.path === 'occurred_at')).toBe(true);
  });

  it('rejects a malformed evidence hash', () => {
    const errs = validateGovernanceEvent(
      trackerEvent({ evidence: { hash: 'too-short' } }),
    );
    expect(errs.some((e) => e.path === 'evidence.hash')).toBe(true);
  });

  it('requires evidence for evidence.sealed', () => {
    const event = {
      name: 'evidence.sealed',
      tenant_id: 'tenant_1',
      severity: 'info',
      actor: { source: 'agent', id: 'sealer' },
      target: 'evidence-chain',
      occurred_at: '2026-05-16T03:22:11Z',
      payload: {
        event_count: 1248,
        bundle_period_start: '2026-04-01T00:00:00Z',
        bundle_period_end: '2026-04-30T23:59:59Z',
      },
    } as unknown as EvidenceSealed;
    const errs = validateGovernanceEvent(event);
    expect(errs.some((e) => e.path === 'evidence')).toBe(true);
  });
});

describe('assertValidGovernanceEvent', () => {
  it('throws GovernanceEventValidationError with the underlying errors', () => {
    try {
      assertValidGovernanceEvent(trackerEvent({ tenant_id: '' }));
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(GovernanceEventValidationError);
      const err = e as GovernanceEventValidationError;
      expect(err.errors.map((x) => x.path)).toContain('tenant_id');
    }
  });

  it('does not throw on a valid event', () => {
    expect(() => assertValidGovernanceEvent(trackerEvent())).not.toThrow();
  });
});

describe('toRuntimeEvent', () => {
  it('maps the governance event onto the runtime envelope', () => {
    const ge: GovernanceEvent = trackerEvent({
      replay_id: 'rp_123',
      evidence: { hash: VALID_HASH, uri: 'inline:' },
    });
    const re = toRuntimeEvent(ge);
    expect(re.name).toBe('tracker.pre_consent.detected');
    expect(re.tenant_id).toBe('tenant_1');
    expect(re.occurred_at).toBe(ge.occurred_at);
    expect(re.payload).toMatchObject({
      severity: 'high',
      target: 'kunde-1.de',
      replay_id: 'rp_123',
      evidence: { hash: VALID_HASH },
      body: {
        tracker: 'googletagmanager',
        consent_state: 'no_banner',
      },
    });
  });
});
