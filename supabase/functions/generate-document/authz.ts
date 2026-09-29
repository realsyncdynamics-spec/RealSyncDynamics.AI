// Pure authorisation rule for generate-document — vitest-importable.
// No Deno / jsr imports; index.ts resolves the caller and the memberships.
//
// The function stays public for the anonymous free-audit flow
// (AuditLanding → DocumentGeneratorBlock), but a document may only be bound
// to a tenant, and a claimed audit may only be read, by a member of that
// tenant. Before this rule the handler took `tenant_id` from the body and
// read any audit by id with the service role.

export interface AuthzInput {
  /** gdpr_audits.tenant_id — null while the audit is anonymous (unclaimed). */
  auditTenantId: string | null;
  /** tenant_id from the request body, if any. */
  requestedTenantId: string | null;
  /** Verified caller, or null for an anonymous request. */
  userId: string | null;
  /** Tenants the caller is a member of (empty when anonymous). */
  memberOf: readonly string[];
}

export type AuthzResult =
  | { ok: true; documentTenantId: string | null }
  | { ok: false; status: 401 | 403; code: string; message: string };

export function authorizeDocument(input: AuthzInput): AuthzResult {
  const { auditTenantId, requestedTenantId, userId, memberOf } = input;

  if (auditTenantId) {
    // Claimed audit: its findings belong to that tenant.
    if (!userId) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'audit belongs to a tenant; sign in' };
    if (!memberOf.includes(auditTenantId)) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'not a member of the audit tenant' };
    }
    if (requestedTenantId && requestedTenantId !== auditTenantId) {
      return { ok: false, status: 403, code: 'CROSS_TENANT', message: 'audit belongs to another tenant' };
    }
    return { ok: true, documentTenantId: auditTenantId };
  }

  // Anonymous audit.
  if (!requestedTenantId) return { ok: true, documentTenantId: null };
  if (!userId) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'tenant_id requires sign-in' };
  if (!memberOf.includes(requestedTenantId)) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'not a member of tenant_id' };
  }
  return { ok: true, documentTenantId: requestedTenantId };
}
