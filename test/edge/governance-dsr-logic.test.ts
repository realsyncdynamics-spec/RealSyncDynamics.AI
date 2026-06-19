/**
 * Contract tests for the pure logic of the governance-dsr edge function
 * (supabase/functions/governance-dsr/logic.ts).
 *
 * Proves the validation + patch-building rules that protect the
 * dsr_requests table:
 *   - request_type / status restricted to the DB CHECK enums
 *   - completed_at stamped on terminal transitions, cleared on reopen
 *   - string fields clamped, affected_assets sanitized
 *   - writer-role gate excludes 'viewer'
 */
import { describe, it, expect } from 'vitest';
import {
  buildClosePatch,
  buildCreate,
  buildUpdatePatch,
  isErasure,
  isWriterRole,
  normalizeExportRequest,
  sanitizeAssets,
} from '../../supabase/functions/governance-dsr/logic';

const NOW = '2026-06-19T12:00:00.000Z';

describe('governance-dsr logic — buildCreate', () => {
  it('rejects a missing tenant_id', () => {
    expect(buildCreate({ request_type: 'access', requester_email: 'a@b.de' }).error).toMatch(/tenant_id/);
  });

  it('rejects an unknown request_type', () => {
    const r = buildCreate({ tenant_id: 't1', request_type: 'spy', requester_email: 'a@b.de' });
    expect(r.error).toMatch(/request_type/);
  });

  it('rejects a missing requester_email', () => {
    const r = buildCreate({ tenant_id: 't1', request_type: 'access' });
    expect(r.error).toMatch(/requester_email/);
  });

  it('normalizes a valid payload with defaults', () => {
    const r = buildCreate({
      tenant_id: 't1', request_type: 'erasure', requester_email: '  USER@Example.de ',
      requester_name: 'Max', subject_description: 'desc', affected_assets: ['a', 1, 'b'],
    });
    expect(r.error).toBeUndefined();
    expect(r.row).toMatchObject({
      tenant_id: 't1', request_type: 'erasure', status: 'received',
      requester_name: 'Max', subject_description: 'desc', affected_assets: ['a', 'b'],
    });
    // email is trimmed but case preserved (HMAC lowercases internally)
    expect(r.row?.requester_email).toBe('USER@Example.de');
  });
});

describe('governance-dsr logic — buildUpdatePatch', () => {
  it('rejects an invalid status', () => {
    expect(buildUpdatePatch({ status: 'nope' }, null, NOW).error).toMatch(/status/);
  });

  it('rejects an empty patch', () => {
    expect(buildUpdatePatch({}, null, NOW).error).toMatch(/no updatable/);
  });

  it('stamps completed_at when entering a terminal state', () => {
    const r = buildUpdatePatch({ status: 'completed' }, null, NOW);
    expect(r.patch).toMatchObject({ status: 'completed', completed_at: NOW });
  });

  it('does not overwrite an existing completed_at', () => {
    const r = buildUpdatePatch({ status: 'rejected' }, '2026-01-01T00:00:00Z', NOW);
    expect(r.patch?.completed_at).toBeUndefined();
    expect(r.patch?.status).toBe('rejected');
  });

  it('clears completed_at when reopening a closed request', () => {
    const r = buildUpdatePatch({ status: 'in_progress' }, '2026-01-01T00:00:00Z', NOW);
    expect(r.patch).toMatchObject({ status: 'in_progress', completed_at: null });
  });

  it('whitelists only known fields', () => {
    const r = buildUpdatePatch({ response_notes: 'x', tenant_id: 'evil', id: 'evil' }, null, NOW);
    expect(r.patch).toEqual({ response_notes: 'x' });
  });
});

describe('governance-dsr logic — buildClosePatch', () => {
  it('defaults to completed', () => {
    expect(buildClosePatch({}, null, NOW).patch).toMatchObject({ status: 'completed', completed_at: NOW });
  });
  it('rejects a non-terminal status', () => {
    expect(buildClosePatch({ status: 'in_progress' }, null, NOW).error).toMatch(/close status/);
  });
});

describe('governance-dsr logic — guards', () => {
  it('sanitizeAssets drops non-strings and caps length', () => {
    expect(sanitizeAssets(['a', 2, null, 'b'])).toEqual(['a', 'b']);
    expect(sanitizeAssets('notarray')).toEqual([]);
  });
  it('isWriterRole excludes viewer and unknown roles', () => {
    expect(isWriterRole('owner')).toBe(true);
    expect(isWriterRole('admin')).toBe(true);
    expect(isWriterRole('member')).toBe(true);
    expect(isWriterRole('viewer')).toBe(false);
    expect(isWriterRole(null)).toBe(false);
  });
});

describe('governance-dsr logic — erasure enqueue gate', () => {
  it('only erasure enqueues the subject', () => {
    expect(isErasure('erasure')).toBe(true);
    expect(isErasure('access')).toBe(false);
    expect(isErasure('portability')).toBe(false);
    expect(isErasure(undefined)).toBe(false);
  });
});

describe('governance-dsr logic — normalizeExportRequest (Art. 15)', () => {
  it('prefers a DSR id when both are present', () => {
    expect(normalizeExportRequest({ id: 'dsr-1', subject_ref: 'abcd1234ef' })).toEqual({ by: 'id', value: 'dsr-1' });
  });
  it('accepts a raw subject_ref', () => {
    expect(normalizeExportRequest({ subject_ref: 'abcd1234ef' })).toEqual({ by: 'subject_ref', value: 'abcd1234ef' });
  });
  it('rejects a too-short subject_ref', () => {
    expect(normalizeExportRequest({ subject_ref: 'short' }).error).toMatch(/subject_ref/);
  });
  it('rejects an empty request', () => {
    expect(normalizeExportRequest({}).error).toMatch(/id or subject_ref/);
  });
});
