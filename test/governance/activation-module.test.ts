import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_MODULES,
  canAccessModule,
  TAB_MODULES,
} from '../../src/components/governance-os/governanceModules';

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
