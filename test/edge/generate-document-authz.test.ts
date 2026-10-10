/**
 * generate-document authorisation (supabase/functions/generate-document/authz.ts).
 *
 * The function stays public for the anonymous free-audit flow, but a
 * document is only bound to a tenant, and a claimed audit only read, by a
 * member of that tenant. Before the fix `tenant_id` came straight from the
 * body and any audit was readable by id.
 *
 * Binding a document is a write into generated_documents, so it follows
 * the writer gate of the other governance-* functions: viewer_auditor is
 * read-only (review on PR #1683).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { authorizeDocument, WRITER_ROLES, isWriterRole } from '../../supabase/functions/generate-document/authz';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const editorOf = (...tenants: string[]) => tenants.map((tenantId) => ({ tenantId, role: 'editor' }));
const viewerOf = (...tenants: string[]) => tenants.map((tenantId) => ({ tenantId, role: 'viewer_auditor' }));

describe('generate-document authz — anonymous audit', () => {
  it('keeps the anonymous free-audit flow working without tenant', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: null, userId: null, memberships: [] }))
      .toEqual({ ok: true, documentTenantId: null });
  });

  it('refuses tenant_id without sign-in', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: A, userId: null, memberships: [] }))
      .toMatchObject({ ok: false, status: 401 });
  });

  it('refuses tenant_id of a foreign tenant', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: B, userId: USER, memberships: editorOf(A) }))
      .toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
  });

  it('binds the document to a tenant the caller writes in', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: A, userId: USER, memberships: editorOf(A) }))
      .toEqual({ ok: true, documentTenantId: A });
  });

  it('refuses viewer_auditor to bind a document to their tenant', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: A, userId: USER, memberships: viewerOf(A) }))
      .toMatchObject({ ok: false, status: 403, code: 'READ_ONLY_ROLE' });
  });
});

describe('generate-document authz — claimed audit', () => {
  it('refuses anonymous reads of a claimed audit', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: null, userId: null, memberships: [] }))
      .toMatchObject({ ok: false, status: 401 });
  });

  it('refuses members of other tenants', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: null, userId: USER, memberships: editorOf(B) }))
      .toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
  });

  it('refuses re-binding a claimed audit to another tenant', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: B, userId: USER, memberships: editorOf(A, B) }))
      .toMatchObject({ ok: false, code: 'CROSS_TENANT' });
  });

  it('binds to the audit tenant for its writers, even without tenant_id', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: null, userId: USER, memberships: editorOf(A) }))
      .toEqual({ ok: true, documentTenantId: A });
  });

  it('refuses viewer_auditor of the audit tenant', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: null, userId: USER, memberships: viewerOf(A) }))
      .toMatchObject({ ok: false, status: 403, code: 'READ_ONLY_ROLE' });
  });

  it('reports cross-tenant before the role, so a viewer learns nothing extra', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: B, userId: USER, memberships: viewerOf(A) }))
      .toMatchObject({ ok: false, code: 'CROSS_TENANT' });
  });
});

describe('generate-document authz — roles', () => {
  it('uses the same writer gate as the other governance-* functions', () => {
    expect([...WRITER_ROLES]).toEqual(['owner', 'admin', 'dpo', 'editor']);
    for (const r of WRITER_ROLES) expect(isWriterRole(r)).toBe(true);
    expect(isWriterRole('viewer_auditor')).toBe(false);
    expect(isWriterRole('member')).toBe(false);
    expect(isWriterRole(null)).toBe(false);
  });

  it('only lists roles allowed by memberships_role_check', () => {
    const migration = readFileSync('supabase/migrations/20260622000000_fix_memberships_role_check_name.sql', 'utf8');
    const check = migration.match(/memberships_role_check\s+CHECK \(role IN \(([^)]*)\)\)/);
    expect(check).not.toBeNull();
    const allowed = [...check![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const r of WRITER_ROLES) expect(allowed).toContain(r);
    expect(WRITER_ROLES).not.toContain('viewer_auditor');
  });
});

describe('generate-document handler (source)', () => {
  const src = readFileSync('supabase/functions/generate-document/index.ts', 'utf8');

  it('authorises before inserting and never writes the raw body tenant_id', () => {
    expect(src).toMatch(/authorizeDocument\(/);
    expect(src.indexOf('authorizeDocument(')).toBeLessThan(src.indexOf(".from('generated_documents')"));
    expect(src).toMatch(/tenant_id: authz\.documentTenantId/);
    expect(src).not.toMatch(/tenant_id: tenantId,/);
  });

  it('loads the role with the membership so authz can gate on it', () => {
    expect(src).toMatch(/from\('memberships'\)\.select\('tenant_id, role'\)/);
  });
});
