import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_MODULES,
  canAccessModule,
  minimumPlanForModule,
  plansForModule,
  TAB_MODULES,
  DOCK_MODULES,
} from '../../src/components/governance-os/governanceModules';
import { PLAN_ORDER } from '../../shared/pricing';

describe('GOVERNANCE_MODULES config', () => {
  it('enthält mindestens 10 Module', () => {
    expect(GOVERNANCE_MODULES.length).toBeGreaterThanOrEqual(10);
  });

  it('jedes Modul hat id, label, route, status und ein Gate', () => {
    for (const mod of GOVERNANCE_MODULES) {
      expect(mod.id, `id fehlt`).toBeTruthy();
      expect(mod.label, `label fehlt für ${mod.id}`).toBeTruthy();
      expect(mod.route, `route fehlt für ${mod.id}`).toMatch(/^\//);
      expect(['live', 'beta', 'roadmap'], `status ungültig für ${mod.id}`).toContain(mod.status);
      expect(['all', 'module', 'permission', 'limit'], `gate ungültig für ${mod.id}`)
        .toContain(mod.gate.kind);
      // Jedes Gate muss von mindestens einem Plan erfüllbar sein — sonst wäre
      // das Modul für niemanden erreichbar.
      expect(plansForModule(mod).length, `kein Plan erreicht ${mod.id}`).toBeGreaterThan(0);
    }
  });

  it('Modulzugriff ist entlang der Plan-Reihenfolge monoton', () => {
    for (const mod of GOVERNANCE_MODULES) {
      const allowed = plansForModule(mod);
      const firstIndex = PLAN_ORDER.indexOf(allowed[0]);
      // Ab dem ersten berechtigten Plan darf kein höherer Plan mehr fehlen.
      for (let i = firstIndex; i < PLAN_ORDER.length; i++) {
        expect(
          canAccessModule(mod, PLAN_ORDER[i]),
          `${mod.id}: ${PLAN_ORDER[i]} verliert Zugriff, den ${allowed[0]} hat`,
        ).toBe(true);
      }
    }
  });

  it('overview und settings sind für alle Pläne zugänglich', () => {
    const allPlans = PLAN_ORDER;
    const overview = GOVERNANCE_MODULES.find((m) => m.id === 'overview');
    const settings = GOVERNANCE_MODULES.find((m) => m.id === 'settings');
    expect(overview).toBeDefined();
    expect(settings).toBeDefined();
    for (const plan of allPlans) {
      expect(canAccessModule(overview!, plan), `overview für ${plan} gesperrt`).toBe(true);
      expect(canAccessModule(settings!, plan), `settings für ${plan} gesperrt`).toBe(true);
    }
  });

  it('KI-Systeme und Risks sind für free gesperrt', () => {
    const aiSystems = GOVERNANCE_MODULES.find((m) => m.id === 'ai-systems');
    const risks = GOVERNANCE_MODULES.find((m) => m.id === 'risks');
    expect(aiSystems).toBeDefined();
    expect(risks).toBeDefined();
    expect(canAccessModule(aiSystems!, 'free')).toBe(false);
    expect(canAccessModule(risks!, 'free')).toBe(false);
  });

  it('Scheduler und Bulk Jobs folgen der Agency-Berechtigung', () => {
    const scheduler = GOVERNANCE_MODULES.find((m) => m.id === 'scheduler')!;
    const bulk = GOVERNANCE_MODULES.find((m) => m.id === 'bulk')!;
    for (const mod of [scheduler, bulk]) {
      expect(canAccessModule(mod, 'growth'), mod.id).toBe(false);
      expect(canAccessModule(mod, 'agency'), mod.id).toBe(true);
      expect(canAccessModule(mod, 'enterprise'), mod.id).toBe(true);
      expect(canAccessModule(mod, 'partner'), mod.id).toBe(true);
    }
  });

  it('Evidence Vault ist ab Starter sichtbar — wie im Pricing ausgewiesen', () => {
    // Vor dem SSoT-Refactoring war der Vault im Pricing ab Starter enthalten,
    // in der Navigation aber erst ab Agency. Dieser Test pinnt die Auflösung.
    const vault = GOVERNANCE_MODULES.find((m) => m.id === 'evidence-vault')!;
    expect(canAccessModule(vault, 'free')).toBe(false);
    expect(canAccessModule(vault, 'starter')).toBe(true);
  });

  it('akzeptiert Altdaten `scale` als Partner', () => {
    const scheduler = GOVERNANCE_MODULES.find((m) => m.id === 'scheduler')!;
    expect(canAccessModule(scheduler, 'scale')).toBe(true);
  });
});

describe('canAccessModule', () => {
  it('gibt true zurück für bekannten Plan', () => {
    const websites = GOVERNANCE_MODULES.find((m) => m.id === 'websites')!;
    expect(canAccessModule(websites, 'free')).toBe(true);
    expect(canAccessModule(websites, 'enterprise')).toBe(true);
  });

  it('gibt false zurück für unbekannten Plan-String', () => {
    const aiSystems = GOVERNANCE_MODULES.find((m) => m.id === 'ai-systems')!;
    expect(canAccessModule(aiSystems, 'unknown-plan')).toBe(false);
  });
});

describe('minimumPlanForModule', () => {
  it('gibt free zurück für free-zugängliche Module', () => {
    const websites = GOVERNANCE_MODULES.find((m) => m.id === 'websites')!;
    expect(minimumPlanForModule(websites)).toBe('free');
  });

  it('gibt starter zurück für starter-Minimum-Module', () => {
    const aiSystems = GOVERNANCE_MODULES.find((m) => m.id === 'ai-systems')!;
    expect(minimumPlanForModule(aiSystems)).toBe('starter');
  });

  it('gibt agency zurück für Scheduler (Berechtigungs-Gate)', () => {
    const scheduler = GOVERNANCE_MODULES.find((m) => m.id === 'scheduler')!;
    expect(minimumPlanForModule(scheduler)).toBe('agency');
  });
});

describe('TAB_MODULES und DOCK_MODULES', () => {
  it('TAB_MODULES enthält nur live und beta Module', () => {
    for (const mod of TAB_MODULES) {
      expect(['live', 'beta']).toContain(mod.status);
    }
  });

  it('DOCK_MODULES enthält nur roadmap Module', () => {
    for (const mod of DOCK_MODULES) {
      expect(mod.status).toBe('roadmap');
    }
  });

  it('TAB_MODULES + DOCK_MODULES = alle Module', () => {
    expect(TAB_MODULES.length + DOCK_MODULES.length).toBe(GOVERNANCE_MODULES.length);
  });
});

describe('moduleConfig.ts (Landing-page Badges)', () => {
  // Import the landing-page module config separately
  it('moduleConfig gibt bekannten Status zurück', async () => {
    const { getModuleStatus, getModulesByStatus } = await import(
      '../../src/features/governance/moduleConfig'
    );
    expect(getModuleStatus('keys')).toBe('live');
    expect(getModuleStatus('remediation')).toBe('roadmap');
    expect(getModuleStatus('vendors')).toBe('beta');
    expect(getModuleStatus('unknown-module')).toBe('roadmap');
  });

  it('getModulesByStatus gibt korrekte Anzahl zurück', async () => {
    const { getModulesByStatus } = await import(
      '../../src/features/governance/moduleConfig'
    );
    const live = getModulesByStatus('live');
    const beta = getModulesByStatus('beta');
    const roadmap = getModulesByStatus('roadmap');
    expect(live.length).toBeGreaterThan(0);
    expect(beta.length).toBeGreaterThan(0);
    expect(roadmap.length).toBeGreaterThan(0);
  });
});
