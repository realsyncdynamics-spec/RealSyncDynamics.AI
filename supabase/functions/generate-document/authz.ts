// Pure authorisation rule for generate-document — vitest-importable.
// No Deno / jsr imports; index.ts resolves the caller and the memberships.
//
// The function stays public for the anonymous free-audit flow
// (AuditLanding → DocumentGeneratorBlock), but a document may only be bound
// to a tenant, and a claimed audit may only be read, by a member of that
// tenant. Before this rule the handler took `tenant_id` from the body and
// read any audit by id with the service role.
//
// Binding a document writes a `generated_documents` row for the tenant, so
// it follows the same writer gate as the other governance-* functions:
// viewer_auditor is read-only and gets 403 (review on PR #1683).

/** Must match the memberships_role_check constraint
 *  (owner | admin | dpo | editor | viewer_auditor). viewer_auditor is read-only. */
export const WRITER_ROLES: readonly string[] = ['owner', 'admin', 'dpo', 'editor'];

/** True for roles that may write tenant data (WRITER_ROLES); viewer_auditor and unknown roles are read-only. */
export function isWriterRole(role: string | null | undefined): boolean {
  return !!role && WRITER_ROLES.includes(role);
}

export interface Membership {
  tenantId: string;
  role: string;
}

export interface AuthzInput {
  /** gdpr_audits.tenant_id — null while the audit is anonymous (unclaimed). */
  auditTenantId: string | null;
  /** tenant_id from the request body, if any. */
  requestedTenantId: string | null;
  /** Verified caller, or null for an anonymous request. */
  userId: string | null;
  /** The caller's memberships with their role (empty when anonymous). */
  memberships: readonly Membership[];
}

export type AuthzResult =
  | { ok: true; documentTenantId: string | null }
  | { ok: false; status: 401 | 403; code: string; message: string };

const READ_ONLY: AuthzResult = {
  ok: false, status: 403, code: 'READ_ONLY_ROLE', message: 'role may not generate tenant documents',
};

/**
 * Decides whether the caller may generate a document for this audit and which
 * tenant it is bound to. Order: sign-in → membership → cross-tenant → writer role.
 */
export function authorizeDocument(input: AuthzInput): AuthzResult {
  const { auditTenantId, requestedTenantId, userId, memberships } = input;
  const roleIn = (tenantId: string) => memberships.find((m) => m.tenantId === tenantId)?.role ?? null;

  if (auditTenantId) {
    // Claimed audit: its findings belong to that tenant.
    if (!userId) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'audit belongs to a tenant; sign in' };
    const role = roleIn(auditTenantId);
    if (!role) {
      return { ok: false, status: 403, code: 'FORBIDDEN', message: 'not a member of the audit tenant' };
    }
    if (requestedTenantId && requestedTenantId !== auditTenantId) {
      return { ok: false, status: 403, code: 'CROSS_TENANT', message: 'audit belongs to another tenant' };
    }
    if (!isWriterRole(role)) return READ_ONLY;
    return { ok: true, documentTenantId: auditTenantId };
  }

  // Anonymous audit.
  if (!requestedTenantId) return { ok: true, documentTenantId: null };
  if (!userId) return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'tenant_id requires sign-in' };
  const role = roleIn(requestedTenantId);
  if (!role) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'not a member of tenant_id' };
  }
  if (!isWriterRole(role)) return READ_ONLY;
  return { ok: true, documentTenantId: requestedTenantId };
}
