/**
 * generate-document authorisation (supabase/functions/generate-document/authz.ts).
 *
 * The function stays public for the anonymous free-audit flow, but a
 * document is only bound to a tenant, and a claimed audit only read, by a
 * member of that tenant. Before the fix `tenant_id` came straight from the
 * body and any audit was readable by id.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { authorizeDocument } from '../../supabase/functions/generate-document/authz';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('generate-document authz — anonymous audit', () => {
  it('keeps the anonymous free-audit flow working without tenant', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: null, userId: null, memberOf: [] }))
      .toEqual({ ok: true, documentTenantId: null });
  });

  it('refuses tenant_id without sign-in', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: A, userId: null, memberOf: [] }))
      .toMatchObject({ ok: false, status: 401 });
  });

  it('refuses tenant_id of a foreign tenant', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: B, userId: USER, memberOf: [A] }))
      .toMatchObject({ ok: false, status: 403 });
  });

  it('binds the document to a tenant the caller belongs to', () => {
    expect(authorizeDocument({ auditTenantId: null, requestedTenantId: A, userId: USER, memberOf: [A] }))
      .toEqual({ ok: true, documentTenantId: A });
  });
});

describe('generate-document authz — claimed audit', () => {
  it('refuses anonymous reads of a claimed audit', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: null, userId: null, memberOf: [] }))
      .toMatchObject({ ok: false, status: 401 });
  });

  it('refuses members of other tenants', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: null, userId: USER, memberOf: [B] }))
      .toMatchObject({ ok: false, status: 403 });
  });

  it('refuses re-binding a claimed audit to another tenant', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: B, userId: USER, memberOf: [A, B] }))
      .toMatchObject({ ok: false, code: 'CROSS_TENANT' });
  });

  it('binds to the audit tenant for its members, even without tenant_id', () => {
    expect(authorizeDocument({ auditTenantId: A, requestedTenantId: null, userId: USER, memberOf: [A] }))
      .toEqual({ ok: true, documentTenantId: A });
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
});
