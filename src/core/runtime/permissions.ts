import type { Capability } from './types';

/**
 * Permissions layer contract. Implementations live outside the runtime core
 * (e.g. backed by RLS + RBAC + capability tokens). Phase 0 ships only the
 * interface; a concrete implementation arrives in Phase 1.
 */
export interface PermissionChecker {
  /**
   * Resolve whether the (tenant, agent) pair is allowed to exercise every
   * capability the skill requires. MUST be deny-by-default: an unknown
   * tenant or unknown capability returns `denied`.
   */
  check(input: PermissionCheckInput): Promise<PermissionDecision>;
}

export interface PermissionCheckInput {
  tenant_id: string;
  agent_id: string;
  skill_id: string;
  required: readonly Capability[];
}

export type PermissionDecision =
  | { outcome: 'granted' }
  | { outcome: 'denied'; missing: readonly Capability[]; reason: string };

/**
 * Pure helper. Given a granted set and a required set, returns the missing
 * capabilities. Order is stable for deterministic audit logs.
 */
export function diffCapabilities(
  granted: readonly Capability[],
  required: readonly Capability[],
): readonly Capability[] {
  const grantedSet = new Set(granted);
  return required.filter((c) => !grantedSet.has(c));
}
