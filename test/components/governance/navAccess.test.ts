/**
 * P0-2 — Nav-Schlösser aus tenant_entitlements statt plan.modules.
 *
 * Free-Mandant = `PLAN_ENTITLEMENTS.free_audit` (deckungsgleich mit
 * `tenant_entitlements_resolve` des Owner-Mandanten laut Inventar).
 */
import { describe, expect, it } from 'vitest';
import { PLAN_ENTITLEMENTS, type EntitlementKey } from '@/shared/pricing';
import { SHELL_NAV } from '../../../src/components/governance-os/shellNav';
import { GOVERNANCE_MODULES } from '../../../src/components/governance-os/governanceModules';
import { decideNavLock, navRequiredKeys, type NavEntitlements } from '../../../src/components/governance-os/navAccess';
import { decideAccess, requirementForPath } from '../../../src/core/access/featureAccess';

function entitlementsOf(planKey: string, extra: Partial<Record<EntitlementKey, number>> = {}): NavEntitlements {
  const values = { ...PLAN_ENTITLEMENTS[planKey], ...extra } as Record<string, number | undefined>;
  return {
    loading: false,
    available: true,
    hasFeature: (key) => {
      const v = values[key];
      return v !== undefined && (v === -1 || v > 0);
    },
  };
}

const FREE = entitlementsOf('free_audit');
const nav = (id: string) => SHELL_NAV.find((i) => i.id === id)!;
const mod = (id: string) => GOVERNANCE_MODULES.find((m) => m.id === id)!;
const navLock = (id: string, ent = FREE, plan = 'free') =>
  decideNavLock({ route: nav(id).route, keys: nav(id).entitlementKeys }, ent, plan);
const moduleLock = (id: string, ent = FREE, plan = 'free') =>
  decideNavLock({ route: mod(id).route, module: mod(id) }, ent, plan);

describe('Hauptnavigation — Free-Mandant', () => {
  it('Enforcement ist gesperrt (policy.packs fehlt), ab Starter', () => {
    const lock = navLock('enforce');
    expect(lock.locked).toBe(true);
    expect(lock.missing).toEqual(['policy.packs']);
    expect(lock.minPlan).toBe('starter');
    expect(lock.source).toBe('entitlement');
  });

  it('KI-Systeme ist offen (governance.ai_register in Free)', () => {
    expect(navLock('systems').locked).toBe(false);
  });

  it('Klassifizierung ist gesperrt (ai_classification.limited = 0)', () => {
    const lock = navLock('classify');
    expect(lock.locked).toBe(true);
    expect(lock.missing).toEqual(['ai_classification.limited']);
  });

  it('Übersicht, Evidence, Berichte, Abrechnung bleiben offen', () => {
    for (const id of ['overview', 'evidence', 'reports', 'billing']) {
      expect(navLock(id).locked, id).toBe(false);
    }
  });

  it('entscheidet nicht mehr über plan.modules: ein falscher Plan-String ändert nichts', () => {
    expect(navLock('systems', FREE, 'nonsense-plan').locked).toBe(false);
    expect(navLock('enforce', FREE, 'enterprise').locked).toBe(true);
  });

  it('Grant/Add-on über tenant_entitlements hebt das Schloss auf', () => {
    expect(navLock('enforce', entitlementsOf('free_audit', { 'policy.packs': 1 })).locked).toBe(false);
  });
});

describe('Weitere Module — Free bleibt gesperrt, wo es gesperrt war', () => {
  it.each([
    ['risks', 'governance.risk_register'],
    ['monitoring', 'monitoring.monthly'],
    ['security-signals', 'monitoring.monthly'],
    ['vendors', 'policy.packs'],
    ['alerts', 'alerts.email'],
  ])('%s ist gesperrt (%s fehlt)', (id, key) => {
    const lock = moduleLock(id);
    expect(lock.locked).toBe(true);
    expect(lock.missing).toContain(key);
  });

  it('KI-Systeme-Modul (Legacy-Gate eu_ai_act) ist über governance.ai_register offen', () => {
    expect(moduleLock('ai-systems').locked).toBe(false);
  });

  it('Starter öffnet Monitoring/Security Signals/Dienstleister/Alerts, Risiken erst ab Growth', () => {
    const starter = entitlementsOf('starter');
    for (const id of ['monitoring', 'security-signals', 'vendors', 'alerts']) {
      expect(moduleLock(id, starter, 'starter').locked, id).toBe(false);
    }
    expect(moduleLock('risks', starter, 'starter').locked).toBe(true);
    expect(moduleLock('risks', entitlementsOf('growth'), 'growth').locked).toBe(false);
  });
});

describe('Schloss ⇔ Routensperre (gleiche Quelle)', () => {
  const routed = [
    ...SHELL_NAV.map((i) => ({ route: i.route, keys: i.entitlementKeys })),
    ...GOVERNANCE_MODULES.map((m) => ({ route: m.route, module: m })),
  ].filter((t) => requirementForPath(t.route) !== null);

  it.each(['free_audit', 'starter', 'growth'])('für %s: Nav-Schloss ⇔ RouteEntitlementGate blockiert', (planKey) => {
    const ent = entitlementsOf(planKey);
    for (const target of routed) {
      const gateBlocks = !decideAccess(requirementForPath(target.route)!, ent.hasFeature).allowed;
      const lock = decideNavLock(target, ent, planKey);
      // Nav kann strenger sein (explizite Zusatz-Keys), nie lockerer als die Route.
      if (gateBlocks) expect(lock.locked, target.route).toBe(true);
    }
    // Enforcement: identische Keys, also exakt gleich.
    const enforceGate = !decideAccess(requirementForPath('/app/policy-packs')!, ent.hasFeature).allowed;
    expect(navLock('enforce', ent, planKey).locked).toBe(enforceGate);
  });

  it('Enforcement nutzt die Keys des Routen-Registers', () => {
    expect(navRequiredKeys({ route: '/app/policy-packs', keys: nav('enforce').entitlementKeys })).toEqual(['policy.packs']);
  });
});

describe('Randfälle wie RouteEntitlementGate', () => {
  it('Entitlements laden noch ⇒ kein Schloss', () => {
    expect(navLock('enforce', { ...FREE, loading: true }).locked).toBe(false);
  });

  it('Entitlements nicht ladbar ⇒ kein Schloss (Durchsetzung serverseitig)', () => {
    expect(navLock('enforce', { ...FREE, available: false }).locked).toBe(false);
  });

  it('kein wählbarer Plan gewährt ai_classification.limited ⇒ minPlan null (kein erfundener Mindestplan)', () => {
    expect(navLock('classify').minPlan).toBeNull();
  });
});
