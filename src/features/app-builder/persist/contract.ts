/**
 * Access + persistence contract for Web App Builder projects.
 *
 * Tenant is NEVER taken from the project payload as authority.
 * Callers must pass a verified Authz (JWT membership on the Edge;
 * injected doubles in tests). A forged tenant_id on the body is ignored.
 */

import type { AuditRecord } from '../bolt/types';

export type PersistOp = 'list' | 'load' | 'save' | 'delete';

export interface PersistAuthz {
  authenticated: boolean;
  /** Verified tenant — membership already checked by the caller. */
  tenantId: string;
  actorId: string;
  entitlementBuilder: boolean;
}

export interface BuilderProjectRecord {
  id: string;
  tenantId: string;
  createdBy: string;
  slug: string;
  title: string;
  files: Record<string, string>;
  merkle: string;
  audit: AuditRecord[];
  messages: { role: 'user' | 'assistant' | 'system'; text: string; at: string }[];
  version: number;
  prevHash: string | null;
  status: 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListItem {
  id: string;
  slug: string;
  title: string;
  updatedAt: string;
  fileCount: number;
  merkle: string;
  version: number;
}

export type PersistDenial = {
  ok: false;
  status: 401 | 403 | 404 | 400;
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'ENTITLEMENT';
  message: string;
};

export function authorizePersist(authz: PersistAuthz, _op: PersistOp): PersistDenial | { ok: true } {
  if (!authz.authenticated || !authz.actorId) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'missing session' };
  }
  if (!authz.tenantId) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'no verified tenant' };
  }
  if (!authz.entitlementBuilder) {
    return {
      ok: false,
      status: 403,
      code: 'ENTITLEMENT',
      message: 'feature siteos.builder is not available on this plan',
    };
  }
  return { ok: true };
}

/** Client-supplied tenant never wins over the verified one. */
export function bindTenant<T>(authz: PersistAuthz, payload: T): T & { tenantId: string } {
  return { ...payload, tenantId: authz.tenantId };
}

export const MAX_FILES = 80;
export const MAX_FILE_BYTES = 200_000;
export const MAX_PROJECT_BYTES = 1_500_000;

export function validateFiles(files: Record<string, string>): PersistDenial | { ok: true } {
  const keys = Object.keys(files);
  if (keys.length > MAX_FILES) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: `too many files (${keys.length})` };
  }
  let total = 0;
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string') {
      return { ok: false, status: 400, code: 'BAD_REQUEST', message: `invalid content for ${path}` };
    }
    const n = content.length;
    if (n > MAX_FILE_BYTES) {
      return { ok: false, status: 400, code: 'BAD_REQUEST', message: `file too large: ${path}` };
    }
    total += n;
  }
  if (total > MAX_PROJECT_BYTES) {
    return { ok: false, status: 400, code: 'BAD_REQUEST', message: 'project too large' };
  }
  return { ok: true };
}
