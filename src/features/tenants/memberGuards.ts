// Pure guard logic for tenant member mutations (P0b, ADR 0005).
// Extracted so it can be unit-tested without a live DB / edge runtime.
// The edge function `supabase/functions/tenant-members` mirrors these rules.

export const TENANT_ROLES = ['owner', 'admin', 'dpo', 'editor', 'viewer_auditor'] as const;
export type TenantMemberRole = (typeof TENANT_ROLES)[number];

export function isValidRole(role: string): role is TenantMemberRole {
  return (TENANT_ROLES as readonly string[]).includes(role);
}

export interface SetRoleCtx {
  callerRole: string | null;
  targetExists: boolean;
  targetCurrentRole: string | null;
  newRole: string;
  ownerCount: number;
  isSelf: boolean;
}

export interface RemoveCtx {
  callerRole: string | null;
  targetExists: boolean;
  targetCurrentRole: string | null;
  ownerCount: number;
  isSelf: boolean;
}

export type GuardResult = { allowed: true } | { allowed: false; code: string };

/** Decide whether a set_role mutation is permitted. */
export function checkSetRole(c: SetRoleCtx): GuardResult {
  if (!isValidRole(c.newRole)) return { allowed: false, code: 'BAD_ROLE' };
  if (c.callerRole !== 'owner' && c.callerRole !== 'admin') return { allowed: false, code: 'FORBIDDEN' };
  if (!c.targetExists) return { allowed: false, code: 'NOT_FOUND' };
  // Only an owner may grant or revoke the owner role.
  if ((c.newRole === 'owner' || c.targetCurrentRole === 'owner') && c.callerRole !== 'owner') {
    return { allowed: false, code: 'FORBIDDEN' };
  }
  // Last-owner protection: cannot demote the final owner.
  if (c.targetCurrentRole === 'owner' && c.newRole !== 'owner' && c.ownerCount <= 1) {
    return { allowed: false, code: 'LAST_OWNER' };
  }
  // Self-demote of the last owner blocked.
  if (c.isSelf && c.callerRole === 'owner' && c.newRole !== 'owner' && c.ownerCount <= 1) {
    return { allowed: false, code: 'SELF_DEMOTE' };
  }
  return { allowed: true };
}

/** Decide whether a remove mutation is permitted. */
export function checkRemove(c: RemoveCtx): GuardResult {
  if (c.callerRole !== 'owner' && c.callerRole !== 'admin') return { allowed: false, code: 'FORBIDDEN' };
  if (!c.targetExists) return { allowed: false, code: 'NOT_FOUND' };
  // Only an owner may remove an owner.
  if (c.targetCurrentRole === 'owner' && c.callerRole !== 'owner') return { allowed: false, code: 'FORBIDDEN' };
  // Last-owner protection.
  if (c.targetCurrentRole === 'owner' && c.ownerCount <= 1) return { allowed: false, code: 'LAST_OWNER' };
  // Self-remove of the last owner blocked.
  if (c.isSelf && c.targetCurrentRole === 'owner' && c.ownerCount <= 1) return { allowed: false, code: 'SELF_REMOVE' };
  return { allowed: true };
}
