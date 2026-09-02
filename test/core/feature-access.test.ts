/**
 * Das Zugriffsregister des Dashboards (`src/core/access/featureAccess.ts`).
 *
 * Was hier bricht, wäre in der Oberfläche ein zahlender Kunde vor einer
 * Sperre oder ein Free-Nutzer auf einer bezahlten Fläche — beides ohne
 * Fehlermeldung. Deshalb:
 *
 *   1. Jede Route im Register existiert in App.tsx (kein Gate ins Leere).
 *   2. Jeder Key ist Teil des kanonischen Vokabulars.
 *   3. Jeder Key wird von mindestens einem wählbaren Plan gewährt.
 *   4. Wo die Navigation ein Modul-Gate hat, sperrt das Register keinen
 *      Plan, den die Navigation zeigt — und umgekehrt (Self-Service-Pläne).
 *   5. Der längste Präfix gewinnt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ENTITLEMENT_KEYS,
  PLAN_ORDER,
  isPlanSelectable,
  planById,
  planGrants,
} from '../../shared/pricing';
import {
  APP_FEATURE_ACCESS,
  addonsCovering,
  cheapestPlanForKeys,
  decideAccess,
  requirementForPath,
  unknownRegistryKeys,
} from '../../src/core/access/featureAccess';
import { GOVERNANCE_MODULES, canAccessModule } from '../../src/components/governance-os/governanceModules';

const APP_TSX = readFileSync('src/App.tsx', 'utf8');
const ROUTES = new Set(
  [...APP_TSX.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]),
);

function routeExists(route: string): boolean {
  if (ROUTES.has(route)) return true;
  // Ein Präfix darf auch nur über Unterrouten existieren (/app/monitoring/*).
  for (const r of ROUTES) if (r.startsWith(`${route}/`)) return true;
  return false;
}

describe('Register — Routen und Keys', () => {
  it.each(APP_FEATURE_ACCESS.map((r) => r.route))('%s ist eine Route in App.tsx', (route) => {
    expect(routeExists(route), `${route} fehlt in App.tsx — das Gate zeigte ins Leere`).toBe(true);
  });

  it('nennt nur Keys aus dem kanonischen Vokabular', () => {
    expect(unknownRegistryKeys()).toEqual([]);
  });

  it('gated nur boolesche Keys — Kontingente divergieren noch (CLAUDE.md §7)', () => {
    for (const req of APP_FEATURE_ACCESS) {
      for (const key of req.allOf) expect(key.startsWith('limit.'), key).toBe(false);
    }
  });

  it('sperrt nichts, was kein wählbarer Plan kaufen kann', () => {
    for (const req of APP_FEATURE_ACCESS) {
      const plan = cheapestPlanForKeys(req.allOf);
      const addon = addonsCovering(req.allOf);
      expect(
        plan !== null || addon.length > 0,
        `${req.route}: ${req.allOf.join(', ')} ist weder in einem wählbaren Plan noch als Add-on erhältlich`,
      ).toBe(true);
    }
  });

  it('gated keine Fläche, die der Free-Plan vollständig enthält', () => {
    for (const req of APP_FEATURE_ACCESS) {
      const freiErhaeltlich = req.allOf.every((key) => planGrants('free_audit', key));
      expect(freiErhaeltlich, `${req.route} ist im Free-Plan enthalten — kein Gate nötig`).toBe(false);
    }
  });

  it('kennt jeden Key wirklich', () => {
    const bekannt = new Set<string>(ENTITLEMENT_KEYS);
    for (const req of APP_FEATURE_ACCESS) for (const k of req.allOf) expect(bekannt.has(k)).toBe(true);
  });
});

describe('Register und Navigation sagen dasselbe', () => {
  /**
   * Für jede Navigationskachel mit Modul-/Berechtigungs-Gate, die eine
   * Route des Registers trägt: Kein Self-Service-Plan darf in der Navigation
   * offen und im Register gesperrt sein — der Kunde klickte sonst auf eine
   * sichtbare Kachel und landete vor einer Sperre.
   */
  const gekoppelt = GOVERNANCE_MODULES
    .filter((m) => m.gate.kind !== 'all')
    .map((m) => ({ modul: m, req: requirementForPath(m.route) }))
    .filter((x): x is { modul: typeof x.modul; req: NonNullable<typeof x.req> } => x.req !== null);

  it('findet Kacheln, die ein Register-Gate tragen (Test nicht leer)', () => {
    expect(gekoppelt.length).toBeGreaterThan(5);
  });

  it.each(gekoppelt.map((x) => [x.modul.id, x.req.route] as const))(
    'Kachel %s und Register %s öffnen für dieselben Self-Service-Pläne',
    (modulId, route) => {
      const { modul, req } = gekoppelt.find((x) => x.modul.id === modulId)!;
      for (const planId of PLAN_ORDER) {
        if (!isPlanSelectable(planId)) continue;
        const plan = planById(planId);
        if (plan.availability !== 'self_service') continue;
        const nav = canAccessModule(modul, planId);
        const reg = decideAccess(req, (key) => planGrants(plan.planKey, key as never)).allowed;
        expect(reg, `${planId}: Navigation ${nav ? 'offen' : 'zu'}, Register für ${route} ${reg ? 'offen' : 'zu'}`).toBe(nav);
      }
    },
  );
});

describe('requirementForPath', () => {
  it('wählt den längsten Präfix', () => {
    expect(requirementForPath('/app/bots')?.allOf).toEqual(['bots.enabled']);
    expect(requirementForPath('/app/bots/whatsapp')?.allOf).toEqual(['bots.whatsapp']);
    expect(requirementForPath('/app/bots/1234')?.allOf).toEqual(['bots.enabled']);
  });

  it('matcht nur auf Segmentgrenzen', () => {
    expect(requirementForPath('/app/botsy')).toBeNull();
    expect(requirementForPath('/app/monitoring/rules')?.allOf).toEqual(['monitoring.monthly']);
  });

  it('lässt freie Flächen frei', () => {
    for (const p of ['/app/dashboard', '/app/marketplace', '/app/billing', '/app/websites', '/app/evidence', '/app/settings', '/app/home']) {
      expect(requirementForPath(p), p).toBeNull();
    }
  });
});

describe('decideAccess', () => {
  it('nennt genau die fehlenden Keys', () => {
    const req = requirementForPath('/app/bots/whatsapp')!;
    expect(decideAccess(req, () => false)).toEqual({ allowed: false, missing: ['bots.whatsapp'] });
    expect(decideAccess(req, () => true)).toEqual({ allowed: true, missing: [] });
  });

  it('kennt für Voice den Add-on-Weg', () => {
    expect(addonsCovering(['bots.voice']).map((a) => a.id)).toContain('voice');
    expect(cheapestPlanForKeys(['bots.voice'])).toBe('enterprise');
  });
});
