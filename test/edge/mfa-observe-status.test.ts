import { describe, expect, it } from 'vitest';
import { resolveObserveStatusResponse } from '../../supabase/functions/_shared/mfaObserveStatus.ts';

describe('mfa observe status helper', () => {
  it('returns 401 for invalid user token branch', () => {
    const out = resolveObserveStatusResponse({ hasValidUser: false, profileLookupFailed: false, isSuperAdmin: false });
    expect(out).toEqual({ status: 401, body: { error: 'invalid_token' } });
  });

  it('returns 500 for profile lookup failure branch', () => {
    const out = resolveObserveStatusResponse({ hasValidUser: true, profileLookupFailed: true, isSuperAdmin: false });
    expect(out).toEqual({ status: 500, body: { error: 'profile_lookup_failed' } });
  });

  it('returns 200 and super-admin flag on success branch', () => {
    const out = resolveObserveStatusResponse({ hasValidUser: true, profileLookupFailed: false, isSuperAdmin: true });
    expect(out).toEqual({ status: 200, body: { is_super_admin: true } });
  });
});
