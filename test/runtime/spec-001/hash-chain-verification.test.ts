/**
 * SPEC-001 — Hash-Chain Verification
 *
 * Pure-Logic-Tests gegen die TS-Spiegelung von
 * public.runtime_events_canonical_bytes(). DB-Integration-Tests
 * stehen als it.todo unten — sie laufen erst, wenn das Staging-
 * Supabase angepingt werden kann (siehe runbook §1.1).
 */
import { describe, expect, it } from 'vitest';
import {
  canonicalEventBytes,
  stableStringify,
  bytesToHex,
  type RuntimeEventEnvelope,
} from '@/src/lib/governance/runtime-math';

const baseEvent: RuntimeEventEnvelope = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  global_seq: 42,
  tenant_seq: 1,
  spec_version: '1.0',
  ts: '2026-05-21T10:00:00.000Z',
  type: 'scan.started',
  severity: 'info',
  source: 'gdpr-audit',
  review_status: 'auto',
  subject_ref: null,
  payload: { vendor: 'acme', count: 3 },
  evidence_refs: [],
  trace_id: null,
  correlation_id: null,
  causation_id: null,
  prev_hash: null,
};

describe('SPEC-001 / canonicalEventBytes', () => {
  it('produces identical bytes for identical input (determinism)', () => {
    const a = canonicalEventBytes(baseEvent);
    const b = canonicalEventBytes({ ...baseEvent });
    expect(bytesToHex(a)).toBe(bytesToHex(b));
  });

  it('is order-independent over payload keys (jsonb canonical-sort)', () => {
    const a = canonicalEventBytes({
      ...baseEvent,
      payload: { vendor: 'acme', count: 3 },
    });
    const b = canonicalEventBytes({
      ...baseEvent,
      payload: { count: 3, vendor: 'acme' },
    });
    expect(bytesToHex(a)).toBe(bytesToHex(b));
  });

  it('differs when any envelope field changes', () => {
    const a = canonicalEventBytes(baseEvent);
    const b = canonicalEventBytes({ ...baseEvent, global_seq: 43 });
    const c = canonicalEventBytes({ ...baseEvent, severity: 'high' });
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
    expect(bytesToHex(a)).not.toBe(bytesToHex(c));
  });

  it('encodes prev_hash as hex string when present (matches PG encode())', () => {
    const prev = new Uint8Array([0xab, 0xcd, 0xef, 0x01]);
    const out = new TextDecoder().decode(
      canonicalEventBytes({ ...baseEvent, prev_hash: prev }),
    );
    expect(out).toContain('"prev_hash":"abcdef01"');
  });

  it('renders prev_hash as JSON null when absent (genesis)', () => {
    const out = new TextDecoder().decode(canonicalEventBytes(baseEvent));
    expect(out).toContain('"prev_hash":null');
  });

  it('normalizes ts to Postgres microsecond ISO with trailing 000Z', () => {
    const out = new TextDecoder().decode(canonicalEventBytes(baseEvent));
    expect(out).toContain('"ts":"2026-05-21T10:00:00.000000Z"');
  });

  it('rejects invalid ts', () => {
    expect(() =>
      canonicalEventBytes({ ...baseEvent, ts: 'not-a-date' }),
    ).toThrow();
  });
});

describe('SPEC-001 / stableStringify', () => {
  it('sorts keys recursively', () => {
    expect(stableStringify({ b: 1, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":1}',
    );
  });

  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('passes through primitives unchanged', () => {
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('x')).toBe('"x"');
    expect(stableStringify(null)).toBe('null');
  });
});

describe('SPEC-001 / hash chain verifier (DB-integration)', () => {
  it.todo(
    'runtime_events_verify_chain returns chain_ok=true for unmodified rows',
  );
  it.todo(
    'runtime_events_verify_chain flags chain_ok=false when prev_hash is corrupted',
  );
  it.todo(
    'runtime_events_verify_chain flags valid=false when event_hash is corrupted',
  );
  it.todo('verifier rejects callers without tenant membership');
});
