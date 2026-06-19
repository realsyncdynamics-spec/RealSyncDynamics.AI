/**
 * Contract tests for the pure logic of the governance-vendors edge function
 * (supabase/functions/governance-vendors/logic.ts).
 *
 * Proves the patch whitelist + enum validation that protect the vendors
 * table CHECK constraints (dpa_status / transfer_mechanism / risk_level),
 * and the writer-role gate.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPatch,
  isWriterRole,
  sanitizeStrArray,
  validateEnums,
} from '../../supabase/functions/governance-vendors/logic';

describe('governance-vendors logic — buildPatch', () => {
  it('whitelists known fields and excludes name + unknown keys', () => {
    const patch = buildPatch({
      name: 'ACME', legal_name: 'ACME GmbH', country: 'DE',
      dpa_status: 'signed', tenant_id: 'evil', id: 'evil', bogus: 'x',
    });
    expect(patch).toMatchObject({ legal_name: 'ACME GmbH', country: 'DE', dpa_status: 'signed' });
    expect('name' in patch).toBe(false);
    expect('tenant_id' in patch).toBe(false);
    expect('bogus' in patch).toBe(false);
  });

  it('sanitizes array fields', () => {
    const patch = buildPatch({ sub_processors: ['AWS', 2, 'Stripe'], data_types_processed: 'x' });
    expect(patch.sub_processors).toEqual(['AWS', 'Stripe']);
    expect(patch.data_types_processed).toEqual([]);
  });
});

describe('governance-vendors logic — validateEnums', () => {
  it('accepts valid enum values', () => {
    expect(validateEnums({ dpa_status: 'signed', transfer_mechanism: 'scc', risk_level: 'high' })).toBeNull();
  });
  it('rejects an invalid dpa_status', () => {
    expect(validateEnums({ dpa_status: 'maybe' })).toMatch(/dpa_status/);
  });
  it('rejects an invalid transfer_mechanism', () => {
    expect(validateEnums({ transfer_mechanism: 'teleport' })).toMatch(/transfer_mechanism/);
  });
  it('rejects an invalid risk_level', () => {
    expect(validateEnums({ risk_level: 'apocalyptic' })).toMatch(/risk_level/);
  });
  it('ignores absent enum fields', () => {
    expect(validateEnums({ legal_name: 'ACME' })).toBeNull();
  });
});

describe('governance-vendors logic — guards', () => {
  it('sanitizeStrArray drops non-strings', () => {
    expect(sanitizeStrArray(['a', 1, 'b', null])).toEqual(['a', 'b']);
    expect(sanitizeStrArray(42)).toEqual([]);
  });
  it('isWriterRole excludes viewer', () => {
    expect(isWriterRole('member')).toBe(true);
    expect(isWriterRole('viewer')).toBe(false);
    expect(isWriterRole(undefined)).toBe(false);
  });
});
