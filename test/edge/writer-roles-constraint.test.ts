/**
 * Writer-role lists of the governance-* edge functions must only name roles
 * that public.memberships can actually hold. A role outside the
 * memberships_role_check constraint (e.g. the former 'member') silently
 * locks out the real roles — dpo and editor got 403 on DSR, vendor and
 * incident writes until this ratchet existed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WRITER_ROLES as DSR } from '../../supabase/functions/governance-dsr/logic';
import { WRITER_ROLES as VENDORS } from '../../supabase/functions/governance-vendors/logic';
import { WRITER_ROLES as INCIDENTS } from '../../supabase/functions/governance-incidents/logic';

const migration = readFileSync(
  'supabase/migrations/20260622000000_fix_memberships_role_check_name.sql',
  'utf8',
);
const check = migration.match(/memberships_role_check\s+CHECK \(role IN \(([^)]*)\)\)/);
const ALLOWED = check ? [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];

describe('governance-* WRITER_ROLES ⊆ memberships_role_check', () => {
  it('parses the constraint', () => {
    expect(ALLOWED).toEqual(['owner', 'admin', 'dpo', 'editor', 'viewer_auditor']);
  });

  for (const [name, roles] of [['governance-dsr', DSR], ['governance-vendors', VENDORS], ['governance-incidents', INCIDENTS]] as const) {
    it(`${name} only lists existing roles and lets dpo/editor write`, () => {
      for (const r of roles) expect(ALLOWED).toContain(r);
      expect(roles).toContain('dpo');
      expect(roles).toContain('editor');
      expect(roles).not.toContain('viewer_auditor');
    });
  }
});
