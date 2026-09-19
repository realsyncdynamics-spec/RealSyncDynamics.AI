import { describe, expect, it } from 'vitest';
import {
  effectiveMfaEnforced,
  requiresAal2ForUnenroll,
  shouldShowMfaObserveBanner,
} from '../../../src/features/settings/mfaObservePolicy';

describe('MFA observe policy', () => {
  it('zeigt Observe-Banner nur für privilegierte Rollen oder super_admin', () => {
    expect(shouldShowMfaObserveBanner('owner', false)).toBe(true);
    expect(shouldShowMfaObserveBanner('admin', false)).toBe(true);
    expect(shouldShowMfaObserveBanner('dpo', false)).toBe(true);
    expect(shouldShowMfaObserveBanner('editor', false)).toBe(false);
    expect(shouldShowMfaObserveBanner('viewer_auditor', false)).toBe(false);
    expect(shouldShowMfaObserveBanner(null, true)).toBe(true);
  });

  it('Public-Sector erzwingt mfa_enforced in der UI unabhängig vom gespeicherten Flag', () => {
    expect(effectiveMfaEnforced(false, true)).toBe(true);
    expect(effectiveMfaEnforced(false, false)).toBe(false);
    expect(effectiveMfaEnforced(true, false)).toBe(true);
  });

  it('Unenroll braucht AAL2 nur wenn verifizierter Faktor vorhanden ist', () => {
    expect(requiresAal2ForUnenroll('aal1', ['verified'])).toBe(true);
    expect(requiresAal2ForUnenroll('aal2', ['verified'])).toBe(false);
    expect(requiresAal2ForUnenroll('aal1', ['unverified'])).toBe(false);
  });
});
