import { describe, it, expect } from 'vitest';
import {
  OPERATIONAL_EVENT_NAMES,
  OPERATIONAL_EVENT_DEFAULTS,
  isOperationalEventName,
} from '../../../src/core/runtime/eventTypes';
import {
  makeOperationalPayload,
  parseOperationalPayload,
  isOperationalPayloadEnvelope,
  OPERATIONAL_PAYLOAD_VERSION,
  DEFAULT_REGION,
} from '../../../src/core/runtime/eventPayload';

describe('OPERATIONAL_EVENT_NAMES', () => {
  it('contains the Phase-1 spec vocabulary', () => {
    const spec = [
      'scan.executed', 'scan.failed',
      'ai.request.detected', 'ai.endpoint.used',
      'risk.assessed', 'risk.high', 'risk.low',
      'policy.checked', 'policy.violation',
      'drift.detected',
      'evidence.created',
    ];
    expect([...OPERATIONAL_EVENT_NAMES]).toEqual(spec);
  });

  it('has a defaults entry for every event name', () => {
    for (const name of OPERATIONAL_EVENT_NAMES) {
      expect(OPERATIONAL_EVENT_DEFAULTS[name]).toBeDefined();
      expect(OPERATIONAL_EVENT_DEFAULTS[name].category).toMatch(
        /^(governance|ai|platform|evidence)$/,
      );
      expect(OPERATIONAL_EVENT_DEFAULTS[name].severity).toMatch(
        /^(info|low|medium|high|critical)$/,
      );
    }
  });

  it('isOperationalEventName narrows correctly', () => {
    expect(isOperationalEventName('scan.executed')).toBe(true);
    expect(isOperationalEventName('execution.started')).toBe(false);
    expect(isOperationalEventName('random.string')).toBe(false);
  });
});

describe('makeOperationalPayload', () => {
  it('builds a valid envelope with sensible defaults', () => {
    const env = makeOperationalPayload({
      source: 'playwright-scanner',
      target: 'https://example.com',
      data: { trackers: 7 },
    });
    expect(env).toEqual({
      source: 'playwright-scanner',
      target: 'https://example.com',
      data: { trackers: 7 },
      meta: { version: OPERATIONAL_PAYLOAD_VERSION, region: DEFAULT_REGION },
    });
    expect(isOperationalPayloadEnvelope(env)).toBe(true);
  });

  it('respects an explicit region override', () => {
    const env = makeOperationalPayload({
      source: 'edge',
      target: 'urn:tenant:t1',
      data: {},
      region: 'eu-west-1',
    });
    expect(env.meta.region).toBe('eu-west-1');
  });
});

describe('parseOperationalPayload', () => {
  const goodPayload = makeOperationalPayload({
    source: 's',
    target: 't',
    data: { k: 'v' },
  });

  it('accepts a well-formed envelope', () => {
    const r = parseOperationalPayload(goodPayload);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.source).toBe('s');
      expect(r.payload.meta.version).toBe(OPERATIONAL_PAYLOAD_VERSION);
    }
  });

  it.each([
    [null, 'payload must be an object'],
    [undefined, 'payload must be an object'],
    ['string', 'payload must be an object'],
    [42, 'payload must be an object'],
  ])('rejects non-object root: %p', (input, expectedReason) => {
    expect(parseOperationalPayload(input)).toEqual({ ok: false, reason: expectedReason });
  });

  it('rejects empty source', () => {
    expect(parseOperationalPayload({ ...goodPayload, source: '' })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/source/),
    });
  });

  it('rejects empty target', () => {
    expect(parseOperationalPayload({ ...goodPayload, target: '' })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/target/),
    });
  });

  it('rejects array data', () => {
    expect(parseOperationalPayload({ ...goodPayload, data: [1, 2] })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/data/),
    });
  });

  it('rejects missing meta', () => {
    const { meta: _meta, ...withoutMeta } = goodPayload;
    expect(parseOperationalPayload(withoutMeta)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/meta/),
    });
  });

  it('rejects malformed meta.version', () => {
    expect(
      parseOperationalPayload({
        ...goodPayload,
        meta: { version: 'v1', region: 'eu-central' },
      }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/version/) });
  });

  it('rejects empty meta.region', () => {
    expect(
      parseOperationalPayload({
        ...goodPayload,
        meta: { version: '1.0', region: '' },
      }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/region/) });
  });
});
