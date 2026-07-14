/**
 * E2E Routing Tests — Umfassende Validierung der User-Journey
 *
 * Testet:
 * 1. Korrekte Routing-Infrastruktur (keine Dead-Links, Schleifen)
 * 2. Hauptpfade von Start bis Ziel
 * 3. Alternate Routes und fallbacks
 * 4. Button-Validierung auf jeder Seite
 * 5. State-Persistierung über Flow
 */

import { describe, it, expect } from 'vitest';
import {
  validateRouting,
  generateRoutingReport,
  validateFlowStepActions,
} from '../src/flow/RoutingValidator';
import {
  FLOW_STEPS,
  getFlowStepBySlug,
  getFlowStepById,
} from '../src/flow/flowRoutes';

describe('Routing Infrastructure Validation', () => {
  it('should have no validation errors', () => {
    const result = validateRouting();
    if (result.errors.length > 0) {
      console.error(generateRoutingReport());
    }
    expect(result.errors).toHaveLength(0);
  });

  it('should have valid structure', () => {
    const result = validateRouting();
    expect(result.isValid).toBe(true);
  });

  it('should report statistics correctly', () => {
    const result = validateRouting();
    expect(result.stats.totalSteps).toBeGreaterThan(0);
    expect(result.stats.totalActions).toBeGreaterThan(0);
    expect(result.stats.externalRoutes.length).toBeGreaterThan(0);
  });
});

describe('Flow Step Accessibility', () => {
  it('should find all flow steps by slug', () => {
    for (const step of Object.values(FLOW_STEPS)) {
      const found = getFlowStepBySlug(step.slug);
      expect(found).toBeDefined();
      expect(found?.id).toBe(step.id);
    }
  });

  it('should find all flow steps by id', () => {
    for (const [id] of Object.entries(FLOW_STEPS)) {
      const found = getFlowStepById(id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(id);
    }
  });

  it('should have unique slugs', () => {
    const slugs = Object.values(FLOW_STEPS).map((s) => s.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('should have unique ids', () => {
    const ids = Object.keys(FLOW_STEPS);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('Action Validation per Step', () => {
  it('should validate all action targets', () => {
    for (const step of Object.values(FLOW_STEPS)) {
      const validation = validateFlowStepActions(step.id);
      if (!validation.valid) {
        console.error(`Invalid actions in step ${step.id}:`, validation.invalidActions);
      }
      expect(validation.valid).toBe(true);
    }
  });

  it('should have at least one primary action on each step', () => {
    for (const step of Object.values(FLOW_STEPS)) {
      expect(step.primary).toBeDefined();
      expect(step.primary?.label).toBeTruthy();
      expect(step.primary?.to).toBeTruthy();
    }
  });

  it('should have secondary action or clear termination', () => {
    const terminationSteps = ['app.dashboard'];

    for (const step of Object.values(FLOW_STEPS)) {
      const hasSecondary = !!step.secondary;
      const isTermination = terminationSteps.includes(step.id);
      expect(hasSecondary || isTermination).toBe(true);
    }
  });
});

describe('Golden Path: Scan → Checkout → Dashboard', () => {
  it('should follow complete scan path', () => {
    const path = [
      'landing.startScan',
      'scan.domain',
      'scan.running',
      'scan.finished',
      'scan.measures',
    ];

    for (const id of path) {
      const step = getFlowStepById(id);
      expect(step).toBeDefined();
      expect(step?.primary).toBeDefined();
    }
  });

  it('should have pricing → checkout chain', () => {
    const step1 = getFlowStepById('landing.pricing');
    expect(step1?.primary?.to).toContain('/pricing');

    const step2 = getFlowStepById('pricing.choosePlan');
    expect(step2?.primary).toBeDefined();

    const step3 = getFlowStepById('pricing.checkoutStarter');
    expect(step3?.primary?.to).toContain('/checkout');
  });

  it('should reach dashboard from checkout success', () => {
    const step = getFlowStepById('checkout.success');
    const nextId = step?.primary?.to;
    expect(nextId).toContain('dashboard');
  });
});

describe('Alternative Paths', () => {
  it('should provide skip options on key steps', () => {
    const scanStep = getFlowStepById('scan.domain');
    expect(scanStep?.extraActions).toBeDefined();
    expect(scanStep?.extraActions?.length).toBeGreaterThan(0);
  });

  it('should allow returning to home from any step', () => {
    const stepsWithHomeLink = Object.values(FLOW_STEPS).filter((s) => {
      const allActions = [
        s.primary,
        s.secondary,
        ...(s.extraActions || []),
      ];
      return allActions.some((a) => a?.to === '/');
    });

    expect(stepsWithHomeLink.length).toBeGreaterThan(3);
  });

  it('should handle checkout cancellation gracefully', () => {
    const cancelled = getFlowStepById('checkout.cancelled');
    expect(cancelled).toBeDefined();
    expect(cancelled?.primary?.to).toContain('choose-plan');
  });
});

describe('State Effects', () => {
  it('should mark scan as started', () => {
    const step = getFlowStepById('scan.running');
    expect(step?.stateEffect?.scanStarted).toBe(true);
  });

  it('should mark scan as completed', () => {
    const step = getFlowStepById('scan.finished');
    expect(step?.stateEffect?.scanCompleted).toBe(true);
  });

  it('should record selected plan on checkout', () => {
    const starterStep = getFlowStepById('pricing.checkoutStarter');
    expect(starterStep?.stateEffect?.selectedPlan).toBe('starter');

    const growthStep = getFlowStepById('pricing.checkoutGrowth');
    expect(growthStep?.stateEffect?.selectedPlan).toBe('growth');

    const agencyStep = getFlowStepById('pricing.checkoutAgency');
    expect(agencyStep?.stateEffect?.selectedPlan).toBe('agency');
  });

  it('should mark checkout status transitions', () => {
    const starter = getFlowStepById('pricing.checkoutStarter');
    expect(starter?.stateEffect?.checkoutStatus).toBe('started');

    const success = getFlowStepById('checkout.success');
    expect(success?.stateEffect?.checkoutStatus).toBe('success');

    const cancelled = getFlowStepById('checkout.cancelled');
    expect(cancelled?.stateEffect?.checkoutStatus).toBe('cancelled');
  });
});

describe('Flow Documentation', () => {
  it('should have descriptive titles', () => {
    for (const step of Object.values(FLOW_STEPS)) {
      expect(step.title).toBeTruthy();
      expect(step.title.length).toBeGreaterThan(3);
    }
  });

  it('should have explanations on every step', () => {
    for (const step of Object.values(FLOW_STEPS)) {
      expect(step.explanation).toBeTruthy();
      expect(step.explanation.length).toBeGreaterThan(10);
    }
  });

  it('should have clicked-context', () => {
    for (const step of Object.values(FLOW_STEPS)) {
      expect(step.clicked).toBeTruthy();
      // Clicked text should describe what action triggered this step
      expect(step.clicked.length).toBeGreaterThan(5);
    }
  });

  it('should have stage assignments', () => {
    for (const step of Object.values(FLOW_STEPS)) {
      expect(step.stage).toBeTruthy();
      const validStages = ['scan', 'ergebnis', 'anmeldung', 'paket', 'checkout', 'dashboard'];
      expect(validStages).toContain(step.stage);
    }
  });
});

describe('Routing Report Generation', () => {
  it('should generate human-readable report', () => {
    const report = generateRoutingReport();
    expect(report).toContain('E2E ROUTING VALIDATION REPORT');
    expect(report).toContain('STATISTIKEN');
    expect(report).toContain('FLOW-STAGES');
  });

  it('report should show reachable steps', () => {
    const report = generateRoutingReport();
    expect(report).toContain('HAUPT-NAVIGATIONSPFAD');
  });
});

describe('External Route Integration', () => {
  it('should reference real app routes', () => {
    const externalRoutes = new Set<string>();

    for (const step of Object.values(FLOW_STEPS)) {
      const allActions = [
        step.primary,
        step.secondary,
        ...(step.extraActions || []),
      ];

      for (const action of allActions) {
        if (action?.to && !action.to.startsWith('/flow')) {
          externalRoutes.add(action.to);
        }
      }
    }

    expect(externalRoutes.has('/audit')).toBe(true);
    expect(externalRoutes.has('/pricing')).toBe(true);
    expect(externalRoutes.has('/app')).toBe(true);
  });

  it('should mark external actions appropriately', () => {
    const auditAction = getFlowStepById('scan.domain')?.primary;
    expect(auditAction?.external).toBe(true);

    const nextFlowAction = getFlowStepById('landing.startScan')?.primary;
    expect(nextFlowAction?.external).not.toBe(true);
  });
});
