/**
 * Auditor Console API — pure-logic tests for the export-bundle builder.
 *
 * The RPC wrappers (fetchTenantQuadrant / fetchRacpo / verifyHashChain /
 * fetchSubjectExport) are thin pass-throughs to supabase-js; they are
 * exercised by the existing DB-integration tests against runtime_events
 * directly. Mocking the full Supabase client here would test the mock,
 * not the contract.
 */
import { describe, expect, it } from 'vitest';
import { buildExportBundle } from '@/src/features/governance/auditorConsoleApi';

describe('Auditor Console / buildExportBundle', () => {
  it('embeds the subject_ref and an ISO timestamp', () => {
    const b = buildExportBundle('abcdef0123456789', []) as Record<string, unknown>;
    expect(b['@type']).toBe('SubjectDataExport');
    expect(b['subject_ref']).toBe('abcdef0123456789');
    expect(String(b['exported_at'])).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it('passes events through unchanged (no client-side mutation)', () => {
    const rows = [
      {
        global_seq: 1, tenant_seq: 1, ts: '2026-05-01T00:00:00Z',
        type: 'dsr.access_requested', severity: 'info',
        payload: { foo: 1 }, evidence_refs: [], prev_hash: null,
        event_hash: '00abc',
      },
    ];
    const b = buildExportBundle('refX', rows) as { events: unknown[] };
    expect(b.events).toBe(rows); // identity — no copy / no mutation
  });

  it('marks proof.verifier_signature as null (signed server-side)', () => {
    const b = buildExportBundle('ref', []) as { proof: { verifier_signature: unknown } };
    expect(b.proof.verifier_signature).toBeNull();
  });

  it('declares the canonical JSON-LD context URL', () => {
    const b = buildExportBundle('ref', []) as Record<string, unknown>;
    expect(b['@context']).toBe('https://schema.realsync.eu/v1/subject-export.jsonld');
  });
});
