/**
 * Schlösser der App-Shell = Route-Gate = Server-Entitlements.
 *
 * Quelle der Wahrheit: `PLAN_ENTITLEMENTS` (shared/pricing.ts), gespiegelt aus
 * den Migrationen (`tenant_entitlements()`), ausgewertet von
 * `RouteEntitlementGate` über das Zugriffsregister `featureAccess.ts`.
 *
 * Regressionen 2026-09-25 (Plan Free):
 *   - Enforcement (/app/policy-packs) ohne Schloss in der Navigation, beim
 *     Klick aber Sperrseite (`policy.packs` ab Starter).
 *   - KI-Systeme/Klassifizierung mit Schloss (Modul `eu_ai_act`), obwohl der
 *     Server das KI-Register (`governance.ai_register`) ab Free freigibt.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PLAN_ENTITLEMENTS, PLAN_ORDER, planById, planGrants, type EntitlementKey } from '@/shared/pricing';
import { isRouteLocked, minimumPlanForRoute } from '@/src/core/access/featureAccess';
import { SHELL_NAV } from '@/src/components/governance-os/shellNav';
import { GOVERNANCE_MODULES, canAccessModule } from '@/src/components/governance-os/governanceModules';

function grantsOf(planKey: string) {
  const set = PLAN_ENTITLEMENTS[planKey] ?? {};
  return (key: string) => {
    const v = set[key as EntitlementKey];
    return v !== undefined && (v === -1 || v > 0);
  };
}

const FREE = grantsOf('free_audit');
const STARTER = grantsOf('starter');

describe('isRouteLocked — gleiche Entscheidung wie RouteEntitlementGate', () => {
  it('Free: Enforcement gesperrt, KI-Systeme und Klassifizierung offen', () => {
    expect(isRouteLocked('/app/policy-packs', FREE, true)).toBe(true);
    expect(isRouteLocked('/app/ai-systems', FREE, true)).toBe(false);
    expect(isRouteLocked('/app/ai-systems/some-id', FREE, true)).toBe(false);
  });

  it('Starter: Enforcement offen', () => {
    expect(isRouteLocked('/app/policy-packs', STARTER, true)).toBe(false);
    expect(minimumPlanForRoute('/app/policy-packs')).toBe('starter');
  });

  it('Entitlements nicht geladen → kein Schloss (Gate zeigt dann auch die Fläche)', () => {
    expect(isRouteLocked('/app/policy-packs', () => false, false)).toBe(false);
  });

  it('korrekte Sperren bleiben: Risiken, Monitoring, Security Signals, Dienstleister, Alerts', () => {
    for (const route of ['/app/risks', '/app/monitoring', '/app/security-signals', '/app/vendors', '/app/alerts']) {
      expect(isRouteLocked(route, FREE, true), route).toBe(true);
    }
    for (const id of ['risks', 'monitoring', 'security-signals', 'vendors', 'alerts']) {
      const mod = GOVERNANCE_MODULES.find((m) => m.id === id)!;
      expect(canAccessModule(mod, 'free'), id).toBe(false);
    }
  });
});

describe('SHELL_NAV', () => {
  it('führt keine zweite Gate-Quelle (kein moduleId)', () => {
    for (const item of SHELL_NAV) {
      expect(item, item.id).not.toHaveProperty('moduleId');
    }
  });

  it('Free: genau Enforcement ist gesperrt', () => {
    const locked = SHELL_NAV.filter((i) => isRouteLocked(i.route, FREE, true)).map((i) => i.id);
    expect(locked).toEqual(['enforce']);
  });
});

describe('Modul „KI-Systeme" folgt governance.ai_register', () => {
  it('ist für jeden Plan offen, dem der Server das KI-Register gewährt', () => {
    const mod = GOVERNANCE_MODULES.find((m) => m.id === 'ai-systems')!;
    for (const planId of PLAN_ORDER) {
      expect(canAccessModule(mod, planId), planId).toBe(planGrants(planById(planId).planKey, 'governance.ai_register'));
    }
    expect(canAccessModule(mod, 'free')).toBe(true);
  });
});

// ── Seitenleiste gerendert ────────────────────────────────────────────────────

const tenant = { entitlements: PLAN_ENTITLEMENTS.free_audit as Record<string, number> | null };
vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 't1',
    tenants: [{ tenantId: 't1', name: 'Muster GmbH' }],
    loading: false,
    entitlements: tenant.entitlements,
    hasFeature: (key: string) => {
      const v = tenant.entitlements?.[key];
      return v !== undefined && (v === -1 || v > 0);
    },
  }),
}));
vi.mock('@/src/hooks/useModuleAccess', () => ({
  useActivePlan: () => ({ plan: 'free', loading: false }),
}));
vi.mock('@/src/components/governance-os/useShellCounts', () => ({
  useShellCounts: () => ({ systems: 2, unclassified: 1, policies: 3, evidence: 4, firstSystemId: null }),
}));

import { GovernanceSidebar } from '@/src/components/governance-os/GovernanceSidebar';
import { MobileBottomNavigation } from '@/src/components/governance-os/MobileBottomNavigation';

describe('GovernanceSidebar / MobileBottomNavigation (Free)', () => {
  it('Seitenleiste: Schloss an Enforcement, nicht an KI-Systemen/Klassifizierung', () => {
    tenant.entitlements = PLAN_ENTITLEMENTS.free_audit as Record<string, number>;
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <GovernanceSidebar />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('side-lock-enforce')).toBeInTheDocument();
    expect(screen.queryByTestId('side-lock-systems')).not.toBeInTheDocument();
    expect(screen.queryByTestId('side-lock-classify')).not.toBeInTheDocument();
    expect(screen.getByTestId('side-nav-systems')).not.toHaveAttribute('data-locked');
  });

  it('Tab-Leiste: gleiches Bild', () => {
    tenant.entitlements = PLAN_ENTITLEMENTS.free_audit as Record<string, number>;
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <MobileBottomNavigation />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('tab-lock-enforce')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-lock-systems')).not.toBeInTheDocument();
  });

  it('Starter: kein Schloss an Enforcement', () => {
    tenant.entitlements = PLAN_ENTITLEMENTS.starter as Record<string, number>;
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <GovernanceSidebar />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('side-lock-enforce')).not.toBeInTheDocument();
  });
});
