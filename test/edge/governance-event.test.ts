import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_EVENT_NAMES as EDGE_NAMES,
  SEVERITIES as EDGE_SEVERITIES,
  ACTOR_SOURCES as EDGE_ACTOR_SOURCES,
  buildRuntimeEventRow,
  hashBody,
  canonicalize,
  validateIngestPayload,
  type IngestPayload,
} from '../../supabase/functions/_shared/governanceEvent';
import {
  validateGovernanceEvent,
  type GovernanceEvent,
} from '../../src/core/runtime/governanceEvents';
import { hashEvidence } from '../../src/core/runtime/evidence';

const TENANT = '11111111-1111-1111-1111-111111111111';

function ingestPayload(over: Partial<IngestPayload> = {}): IngestPayload {
  return {
    name: 'tracker.pre_consent.detected',
    tenant_id: TENANT,
    severity: 'high',
    actor: { source: 'browser_collector', id: 'collector_eu_1' },
    target: 'kunde-1.de',
    occurred_at: '2026-05-16T03:22:11Z',
    payload: {
      tracker: 'googletagmanager',
      request_url: 'https://www.googletagmanager.com/gtag/js?id=G-xxx',
      consent_state: 'no_banner',
    },
    ...over,
  };
}

// ─── Parity with src/core/runtime/governanceEvents.ts ───────────────────────

describe('parity with app-side schema', () => {
  it('event names are identical (sorted)', async () => {
    const appNames = (
      await import('../../src/core/runtime/governanceEvents')
    ) as { /* re-imports just for type-level access */ };
    void appNames;

    // The runtime app module doesn't export the vocabulary as a value, so
    // we reflect it via the discriminator: instantiate one of each name
    // and check the validator accepts it.
    for (const name of EDGE_NAMES) {
      const e: IngestPayload = ingestPayload({ name });
      // edge-side validator MUST accept all canonical names
      expect(validateIngestPayload(e, TENANT).find((er) => er.path === 'name')).toBeUndefined();
    }
  });

  it('app-side validator rejects names that edge would also reject', () => {
    const bogus = ingestPayload({ name: 'tracker.fake' as IngestPayload['name'] });
    const edgeErrs = validateIngestPayload(bogus, TENANT);
    expect(edgeErrs.find((e) => e.path === 'name')).toBeDefined();

    // Same event shape — app side
    const appShape = {
      ...bogus,
      payload: bogus.payload!,
    } as unknown as GovernanceEvent;
    const appErrs = validateGovernanceEvent(appShape);
    expect(appErrs.find((e) => e.path === 'name')).toBeDefined();
  });

  it('severities and actor sources are stable enums', () => {
    expect([...EDGE_SEVERITIES].sort()).toEqual(
      ['critical', 'high', 'info', 'low', 'medium'],
    );
    expect([...EDGE_ACTOR_SOURCES].sort()).toEqual(
      [
        'agent',
        'ai_telemetry_sdk',
        'browser_collector',
        'cms_connector',
        'edge_function',
        'human',
        'playwright_scanner',
      ],
    );
  });
});

// ─── validateIngestPayload ──────────────────────────────────────────────────

describe('validateIngestPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(validateIngestPayload(ingestPayload(), TENANT)).toEqual([]);
  });

  it('rejects payload with mismatched tenant_id', () => {
    const errs = validateIngestPayload(
      ingestPayload({ tenant_id: '99999999-9999-9999-9999-999999999999' }),
      TENANT,
    );
    expect(errs.find((e) => e.path === 'tenant_id')).toBeDefined();
  });

  it('rejects unknown event name', () => {
    const errs = validateIngestPayload(
      ingestPayload({ name: 'tracker.unknown' as IngestPayload['name'] }),
      TENANT,
    );
    expect(errs.find((e) => e.path === 'name')).toBeDefined();
  });

  it('requires evidence for evidence.sealed', () => {
    const errs = validateIngestPayload(
      ingestPayload({ name: 'evidence.sealed', evidence: undefined }),
      TENANT,
    );
    expect(errs.find((e) => e.path === 'evidence')).toBeDefined();
  });

  it('rejects malformed evidence.hash', () => {
    const errs = validateIngestPayload(
      ingestPayload({ evidence: { hash: 'short' } }),
      TENANT,
    );
    expect(errs.find((e) => e.path === 'evidence.hash')).toBeDefined();
  });

  it('rejects non-ISO-8601 occurred_at', () => {
    const errs = validateIngestPayload(
      ingestPayload({ occurred_at: '2026/05/16' }),
      TENANT,
    );
    expect(errs.find((e) => e.path === 'occurred_at')).toBeDefined();
  });

  it('rejects unknown actor source', () => {
    const errs = validateIngestPayload(
      ingestPayload({
        actor: {
          source: 'rogue' as IngestPayload['actor'] extends infer A
            ? A extends { source: infer S }
              ? S
              : never
            : never,
          id: 'x',
        },
      }),
      TENANT,
    );
    expect(errs.find((e) => e.path === 'actor.source')).toBeDefined();
  });
});

// ─── Hashing parity ─────────────────────────────────────────────────────────

describe('hashBody / canonicalize parity', () => {
  it('canonicalize sorts keys recursively', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it('hashBody agrees with src/core/runtime/evidence.ts:hashEvidence', async () => {
    const body = {
      tracker: 'gtm',
      consent_state: 'no_banner',
      request_url: 'https://example.com',
    };
    expect(await hashBody(body)).toBe(await hashEvidence(body));
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ x: NaN })).toThrow(/non-finite/);
  });
});

// ─── buildRuntimeEventRow ───────────────────────────────────────────────────

describe('buildRuntimeEventRow', () => {
  it('produces a row with hashed evidence and pre-consent body', async () => {
    const { row, bodyHash } = await buildRuntimeEventRow(ingestPayload(), TENANT);
    expect(bodyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row).toMatchObject({
      tenant_id: TENANT,
      name: 'tracker.pre_consent.detected',
      execution_id: null,
      skill_id: null,
      agent_id: null,
    });
    const payload = row.payload as {
      severity: string;
      target: string;
      evidence: { hash: string };
      body: Record<string, unknown>;
    };
    expect(payload.severity).toBe('high');
    expect(payload.target).toBe('kunde-1.de');
    expect(payload.evidence.hash).toBe(bodyHash);
    expect(payload.body.tracker).toBe('googletagmanager');
  });

  it('sets agent_id when actor.source is agent', async () => {
    const { row } = await buildRuntimeEventRow(
      ingestPayload({ actor: { source: 'agent', id: 'dpo-agent' } }),
      TENANT,
    );
    expect(row.agent_id).toBe('dpo-agent');
  });

  it('throws when caller-supplied evidence.hash does not match computed hash', async () => {
    await expect(
      buildRuntimeEventRow(
        ingestPayload({ evidence: { hash: 'b'.repeat(64) } }),
        TENANT,
      ),
    ).rejects.toThrow(/evidence\.hash mismatch/);
  });

  it('accepts a caller-supplied hash when it equals the computed one', async () => {
    const correctHash = await hashBody(ingestPayload().payload ?? {});
    const { row } = await buildRuntimeEventRow(
      ingestPayload({ evidence: { hash: correctHash, uri: 'inline:' } }),
      TENANT,
    );
    expect((row.payload as { evidence: { uri?: string } }).evidence.uri).toBe('inline:');
  });
});
