import { beforeEach, describe, expect, it, vi } from 'vitest';

const listFactorsMock = vi.fn();
const getAalMock = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      mfa: {
        listFactors: listFactorsMock,
        getAuthenticatorAssuranceLevel: getAalMock,
      },
    },
  }),
}));

import { getMfaStatus } from '../../src/core/access/mfa';

describe('getMfaStatus', () => {
  beforeEach(() => {
    listFactorsMock.mockReset();
    getAalMock.mockReset();
  });

  it('mapped TOTP factors include friendly_name and pending count', async () => {
    listFactorsMock.mockResolvedValue({
      data: {
        all: [
          { id: 'f1', status: 'verified', factor_type: 'totp', friendly_name: 'Laptop Token' },
          { id: 'f2', status: 'unverified', factor_type: 'totp', friendly_name: null },
          { id: 'sms1', status: 'verified', factor_type: 'phone' },
        ],
      },
    });
    getAalMock.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' } });

    const status = await getMfaStatus();
    expect(status.hasVerifiedTotp).toBe(true);
    expect(status.factorCount).toBe(2);
    expect(status.pendingCount).toBe(1);
    expect(status.currentLevel).toBe('aal1');
    expect(status.nextLevel).toBe('aal2');
    expect(status.factors).toEqual([
      { id: 'f1', status: 'verified', friendlyName: 'Laptop Token' },
      { id: 'f2', status: 'unverified', friendlyName: null },
    ]);
  });
});
