/**
 * RFC-002 — subject_ref Lifecycle
 *
 * Pure-logic: canonical message construction. DB-integration: HMAC compute,
 * rotation lifecycle, deletion semantics, RLS.
 */
import { describe, expect, it } from 'vitest';
import { subjectRefCanonicalMessage } from '@/src/lib/governance/runtime-math';

describe('RFC-002 / canonical message', () => {
  it('lower-cases and trims the value', () => {
    const a = subjectRefCanonicalMessage('email', '  Alice@Example.com  ');
    const b = subjectRefCanonicalMessage('email', 'alice@example.com');
    expect(new TextDecoder().decode(a)).toBe(new TextDecoder().decode(b));
  });

  it('uses \\x1f as separator between kind and value', () => {
    const out = new TextDecoder().decode(
      subjectRefCanonicalMessage('email', 'x@y.de'),
    );
    expect(out).toBe('email\x1fx@y.de');
  });

  it('differs between subject kinds for identical values', () => {
    const a = new TextDecoder().decode(
      subjectRefCanonicalMessage('email', 'foo'),
    );
    const b = new TextDecoder().decode(
      subjectRefCanonicalMessage('user_id', 'foo'),
    );
    expect(a).not.toBe(b);
  });
});

describe('RFC-002 / HMAC compute (DB)', () => {
  it.todo('subject_ref_compute returns identical hex for identical inputs');
  it.todo(
    'subject_ref_compute returns DIFFERENT hex for two tenants on the same plaintext (no cross-tenant correlation)',
  );
  it.todo('subject_ref_compute raises when no usable key exists');
});

describe('RFC-002 / key rotation lifecycle', () => {
  it.todo('rotate_subject_ref_key creates new active key + downgrades old to rotating');
  it.todo('expired rotating keys auto-transition to retired');
  it.todo('explicit p_key_version uses an older key only if status in (active, rotating)');
  it.todo('rotation is service-role only');
});

describe('RFC-002 / deletion semantics', () => {
  it.todo(
    'request_subject_erasure sets deletion_requested_at and emits dsr.erasure_requested',
  );
  it.todo(
    'process_subject_erasure_queue nulls encrypted_value after retention hold',
  );
  it.todo(
    'soft-erased mapping leaves runtime_events.subject_ref intact (audit trail preserved)',
  );
  it.todo(
    'destroying the key (cryptographic erasure) makes subject_ref non-invertible',
  );
});

describe('RFC-002 / DSGVO export', () => {
  it.todo('subject_dsr_export_v restricts via security_invoker + RLS');
  it.todo(
    'incident_correlation_export returns events ordered by tenant_seq ASC',
  );
  it.todo(
    'export bundle JSON-LD includes proof.verifier_signature with Ed25519 alg',
  );
  it.todo('export hash-chain verifies with public key');
});

describe('RFC-002 / RLS', () => {
  it.todo('cross-tenant subject_ref lookup returns empty (RLS isolation)');
  it.todo(
    'tenant member sees only their tenant rows in subject_dsr_export_v',
  );
  it.todo('non-member receives 0 rows on runtime_events with subject_ref filter');
});
