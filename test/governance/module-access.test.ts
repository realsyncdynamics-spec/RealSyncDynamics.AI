import { describe, it, expect } from 'vitest';
import {
  GOVERNANCE_MODULES,
  canAccessModule,
  minimumPlanForModule,
  TAB_MODULES,
  DOCK_MODULES,
} from '../../src/components/governance-os/governanceModules';

describe('GOVERNANCE_MODULES config', () => {
  it('enthält mindestens 10 Module', () => {
    expect(GOVERNANCE_MODULES.length).toBeGreaterThanOrEqual(10);
  });

  it('jedes Modul hat id, label, route, status und plans', () => {
    for (const mod of GOVERNANCE_MODULES) {
      expect(mod.id, `id fehlt`).toBeTruthy();
      expect(mod.label, `label fehlt für ${mod.id}`).toBeTruthy();
      expect(mod.route, `route fehlt für ${mod.id}`).toMatch(/^\//);
      expect(['live', 'beta', 'roadmap'], `status ungültig für ${mod.id}`).toContain(mod.status);
      expect(mod.plans.length, `plans leer für ${mod.id}`).toBeGreaterThan(0);
    }
  });

  it('overview und settings sind für alle Pläne zugänglich', () => {
    const allPlans = ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'];
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

  it('Remediation ist nur für agency+ zugänglich', () => {
    const remediation = GOVERNANCE_MODULES.find((m) => m.id === 'remediation');
    expect(remediation).toBeDefined();
    expect(canAccessModule(remediation!, 'free')).toBe(false);
    expect(canAccessModule(remediation!, 'starter')).toBe(false);
    expect(canAccessModule(remediation!, 'growth')).toBe(false);
    expect(canAccessModule(remediation!, 'agency')).toBe(true);
    expect(canAccessModule(remediation!, 'enterprise')).toBe(true);
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

  it('gibt agency zurück für remediation', () => {
    const remediation = GOVERNANCE_MODULES.find((m) => m.id === 'remediation')!;
    expect(minimumPlanForModule(remediation)).toBe('agency');
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
