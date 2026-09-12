import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_MODULES,
  canAccessModule,
  TAB_MODULES,
} from '../../src/components/governance-os/governanceModules';
import { osEntryPath } from '../../src/components/landing/OsEntryLink';
import { EMPTY_ORGANIZATION } from '../../src/features/activation/activationApi';

describe('activation Modul', () => {
  const activation = GOVERNANCE_MODULES.find((m) => m.id === 'activation');

  it('ist in GOVERNANCE_MODULES vorhanden', () => {
    expect(activation).toBeDefined();
  });

  it('hat status beta', () => {
    expect(activation?.status).toBe('beta');
  });

  it('Route ist /app/activation', () => {
    expect(activation?.route).toBe('/app/activation');
  });

  it('ist für alle Pläne inkl. free zugänglich (Preview-Slice)', () => {
    for (const plan of ['free', 'starter', 'growth', 'agency', 'enterprise']) {
      expect(canAccessModule(activation!, plan), `activation für ${plan}`).toBe(true);
    }
  });

  it('erscheint in TAB_MODULES (beta)', () => {
    expect(TAB_MODULES.some((m) => m.id === 'activation')).toBe(true);
  });

  it('heißt Activation und nicht Onboarding', () => {
    expect(activation?.label).toBe('Activation');
    expect(activation?.label.toLowerCase()).not.toContain('onboarding');
  });
});

describe('osEntryPath', () => {
  it('leitet öffentliche Nutzer über /welcome?next=', () => {
    expect(osEntryPath('/app/evidence', false)).toBe(
      '/welcome?next=%2Fapp%2Fevidence',
    );
  });

  it('lässt authentifizierte Nutzer direkt in die OS-Fläche', () => {
    expect(osEntryPath('/app/modules', true)).toBe('/app/modules');
  });
});

describe('activationApi defaults', () => {
  it('liefert leere Organization ohne Fake-KPIs', () => {
    expect(EMPTY_ORGANIZATION.company).toBe('');
    expect(Object.values(EMPTY_ORGANIZATION).every((v) => v === '')).toBe(true);
  });
});
