import { describe, expect, it } from 'vitest';
import {
  checkCreativeAdmission,
  type CreativeAdmissionContext,
} from '../../supabase/functions/_shared/creativeAdmission';

const permitted: CreativeAdmissionContext = {
  authenticatedUserId: 'user-a',
  tenantId: 'tenant-a',
  memberTenantIds: ['tenant-a'],
  featureEnabled: true,
  estimatedCostMinor: 10,
  availableBudgetMinor: 50,
  reservationConfirmed: true,
};

describe('Creative admission gate', () => {
  it('allows only a complete server-verified admission context', () => {
    expect(checkCreativeAdmission(permitted)).toEqual({ allowed: true });
  });

  it.each([
    [{ authenticatedUserId: null }, 'AUTH_REQUIRED'],
    [{ tenantId: 'tenant-b' }, 'TENANT_FORBIDDEN'],
    [{ tenantId: null }, 'TENANT_FORBIDDEN'],
    [{ featureEnabled: false }, 'FEATURE_DISABLED'],
    [{ estimatedCostMinor: 0 }, 'INVALID_BUDGET'],
    [{ estimatedCostMinor: NaN }, 'INVALID_BUDGET'],
    [{ availableBudgetMinor: -1 }, 'INVALID_BUDGET'],
    [{ estimatedCostMinor: 100 }, 'BUDGET_EXCEEDED'],
    [{ reservationConfirmed: false }, 'RESERVATION_REQUIRED'],
  ] as const)('rejects unsafe state %#', (overrides, code) => {
    expect(checkCreativeAdmission({ ...permitted, ...overrides }))
      .toEqual({ allowed: false, code });
  });

  it('requires exact tenant membership', () => {
    expect(checkCreativeAdmission({
      ...permitted, memberTenantIds: ['tenant-b'],
    })).toEqual({ allowed: false, code: 'TENANT_FORBIDDEN' });
  });
});
