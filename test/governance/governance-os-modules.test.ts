import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_MODULES,
  canAccessModule,
  minimumPlanForModule,
  TAB_MODULES,
  DOCK_MODULES,
} from '../../src/components/governance-os/governanceModules';

// ── Neue Module: alerts + billing ─────────────────────────────────────────

describe('alerts Modul', () => {
  const alerts = GOVERNANCE_MODULES.find((m) => m.id === 'alerts');

  it('ist in GOVERNANCE_MODULES vorhanden', () => {
    expect(alerts).toBeDefined();
  });

  it('hat status beta', () => {
    expect(alerts?.status).toBe('beta');
  });

  it('Route ist /app/alerts', () => {
    expect(alerts?.route).toBe('/app/alerts');
  });

  it('ist für free gesperrt', () => {
    expect(canAccessModule(alerts!, 'free')).toBe(false);
  });

  it('ist ab starter zugänglich', () => {
    expect(canAccessModule(alerts!, 'starter')).toBe(true);
    expect(canAccessModule(alerts!, 'growth')).toBe(true);
    expect(canAccessModule(alerts!, 'enterprise')).toBe(true);
  });

  it('Minimum-Plan ist starter', () => {
    expect(minimumPlanForModule(alerts!)).toBe('starter');
  });

  it('erscheint in TAB_MODULES (beta)', () => {
    expect(TAB_MODULES.some((m) => m.id === 'alerts')).toBe(true);
  });
});

describe('billing Modul', () => {
  const billing = GOVERNANCE_MODULES.find((m) => m.id === 'billing');

  it('ist in GOVERNANCE_MODULES vorhanden', () => {
    expect(billing).toBeDefined();
  });

  it('hat status live', () => {
    expect(billing?.status).toBe('live');
  });

  it('Route ist /app/billing', () => {
    expect(billing?.route).toBe('/app/billing');
  });

  it('ist für alle Pläne inkl. free zugänglich', () => {
    const allPlans = ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'];
    for (const plan of allPlans) {
      expect(canAccessModule(billing!, plan), `billing für ${plan} gesperrt`).toBe(true);
    }
  });

  it('erscheint in TAB_MODULES (live)', () => {
    expect(TAB_MODULES.some((m) => m.id === 'billing')).toBe(true);
  });
});

// ── TAB_MODULES / DOCK_MODULES konsistenz ─────────────────────────────────

describe('TAB_MODULES + DOCK_MODULES Vollständigkeit', () => {
  it('enthält alle GOVERNANCE_MODULES', () => {
    expect(TAB_MODULES.length + DOCK_MODULES.length).toBe(GOVERNANCE_MODULES.length);
  });

  it('alle Routen sind eindeutig', () => {
    const routes = GOVERNANCE_MODULES.map((m) => m.route);
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
  });

  it('alle IDs sind eindeutig', () => {
    const ids = GOVERNANCE_MODULES.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
