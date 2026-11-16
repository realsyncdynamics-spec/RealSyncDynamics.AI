/**
 * Pure Creative Studio admission gate. This module does not reserve money,
 * read a database or authorize tenants by itself.
 *
 * The calling Edge Function MUST obtain these values server-side from the
 * authenticated user, tenant membership, entitlement resolver and an atomic
 * reservation transaction. Never construct this context from request JSON.
 */
export interface CreativeAdmissionContext {
  authenticatedUserId: string | null;
  tenantId: string | null;
  memberTenantIds: readonly string[];
  featureEnabled: boolean;
  estimatedCostMinor: number;
  availableBudgetMinor: number;
  reservationConfirmed: boolean;
}

export type CreativeAdmissionCode =
  | 'AUTH_REQUIRED'
  | 'TENANT_FORBIDDEN'
  | 'FEATURE_DISABLED'
  | 'INVALID_BUDGET'
  | 'BUDGET_EXCEEDED'
  | 'RESERVATION_REQUIRED';

export type CreativeAdmissionResult =
  | { allowed: true }
  | { allowed: false; code: CreativeAdmissionCode };

/**
 * Fail closed. A read-only balance check is insufficient: the caller must
 * confirm an atomic reservation for this exact job before invoking xAI.
 */
export function checkCreativeAdmission(
  context: CreativeAdmissionContext,
): CreativeAdmissionResult {
  if (!context.authenticatedUserId) {
    return { allowed: false, code: 'AUTH_REQUIRED' };
  }
  if (!context.tenantId || !context.memberTenantIds.includes(context.tenantId)) {
    return { allowed: false, code: 'TENANT_FORBIDDEN' };
  }
  if (!context.featureEnabled) {
    return { allowed: false, code: 'FEATURE_DISABLED' };
  }
  if (!Number.isSafeInteger(context.estimatedCostMinor) ||
      !Number.isSafeInteger(context.availableBudgetMinor) ||
      context.estimatedCostMinor <= 0 || context.availableBudgetMinor < 0) {
    return { allowed: false, code: 'INVALID_BUDGET' };
  }
  if (context.estimatedCostMinor > context.availableBudgetMinor) {
    return { allowed: false, code: 'BUDGET_EXCEEDED' };
  }
  if (!context.reservationConfirmed) {
    return { allowed: false, code: 'RESERVATION_REQUIRED' };
  }
  return { allowed: true };
}
