/**
 * Produkt-Suite (Build Studio · Agent Studio · Governance OS).
 *
 * Vertrag:
 * - Status folgt der Registry `implementation-status.ts`; nichts wird ohne
 *   Registry-Eintrag oder expliziten Beleg als LIVE ausgewiesen.
 * - Öffentliche CTAs führen auf existierende Routen und verwenden keine
 *   Pilot-/Demo-/Call-/Sales-/Beratungs-/Termin-Formulierungen (AGENTS.md).
 * - Freischaltungs-Keys existieren in `ENTITLEMENT_KEYS`.
 * - Die Startseite `/` rendert das Produktportal; Landing v6 bleibt erreichbar.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENTITLEMENT_KEYS } from '../../shared/pricing';
import { getImplementation } from '../../src/product/implementation-status';
import { PLATFORM_FLOW, PRODUCTS, appDeepLink } from '../../src/product/productSuite';

const APP = readFileSync(resolve('src/App.tsx'), 'utf8');
const ROUTES = [...APP.matchAll(/\bpath="([^"]+)"/g)].map((m) => m[1]);

function routeExists(href: string): boolean {
  const path = href.split(/[?#]/)[0];
  return ROUTES.some((r) => {
    if (r === '*') return false;
    const re = new RegExp(`^${r.replace(/:[^/]+/g, '[^/]+')}/?$`);
    return re.test(path);
  });
}

const FORBIDDEN_CTA = /pilot|demo|call|sales|beratung|termin/i;

describe('Produkt-Suite', () => {
  it('hat genau drei Produkte in der Reihenfolge BUILD, AUTOMATE, GOVERN', () => {
    expect(PRODUCTS.map((p) => p.verb)).toEqual(['BUILD', 'AUTOMATE', 'GOVERN']);
  });

  it('übernimmt den Status aus der Registry (fail-closed)', () => {
    for (const p of PRODUCTS) {
      for (const c of p.capabilities) {
        const ref = c.evidence.find((e) => e.startsWith('src/product/implementation-status.ts#'));
        if (!ref) {
          // Explizit gesetzter Status braucht einen Beleg — außer NOT IMPLEMENTED.
          if (c.status !== 'not-implemented') expect(c.evidence.length, c.id).toBeGreaterThan(0);
          expect(c.status, c.id).not.toBe('live');
          continue;
        }
        const implId = ref.split('#')[1];
        const item = getImplementation(implId);
        expect(item, `${c.id} → ${implId}`).toBeDefined();
        if (item?.status !== 'live') expect(c.status, c.id).not.toBe('live');
      }
    }
  });

  it('weist Telefonie und WhatsApp-Produktivbetrieb nicht als LIVE aus', () => {
    const automate = PRODUCTS.find((p) => p.id === 'automate')!;
    const byId = Object.fromEntries(automate.capabilities.map((c) => [c.id, c.status]));
    expect(byId['automate-voice-runtime']).toBe('blocked');
    expect(byId['automate-whatsapp-prod']).toBe('blocked');
    expect(PLATFORM_FLOW.find((s) => s.step === 'DEPLOY')?.status).toBe('blocked');
  });

  it('CTAs führen auf existierende Routen und vermeiden verbotene Formulierungen', () => {
    for (const p of PRODUCTS) {
      for (const cta of [p.primaryCta, p.secondaryCta]) {
        expect(routeExists(cta.to), cta.to).toBe(true);
        expect(cta.label, cta.label).not.toMatch(FORBIDDEN_CTA);
      }
      expect(routeExists(p.pageRoute), p.pageRoute).toBe(true);
      for (const s of p.appSurfaces) {
        const target = s.to.startsWith('/welcome?next=')
          ? decodeURIComponent(s.to.slice('/welcome?next='.length))
          : s.to;
        expect(routeExists(target), target).toBe(true);
      }
    }
  });

  it('verwendet nur bekannte Freischaltungs-Keys', () => {
    const known = new Set<string>(ENTITLEMENT_KEYS);
    for (const p of PRODUCTS) for (const k of p.entitlementKeys) expect(known.has(k), k).toBe(true);
    const build = PRODUCTS.find((p) => p.id === 'build')!;
    expect(build.entitlementKeys).toEqual(['siteos.builder', 'siteos.publish', 'limit.sites']);
  });

  it('Deep-Links laufen über den kanonischen Login-Einstieg', () => {
    expect(appDeepLink('/app/bots')).toBe('/welcome?next=%2Fapp%2Fbots');
  });
});

describe('Routing der Startseite', () => {
  it('`/` rendert das Produktportal, Landing v6 bleibt unter /design/landing-v6', () => {
    expect(APP).toContain('<Route path="/" element={<ProductPortal />} />');
    expect(APP).toContain('<Route path="/design/landing-v6" element={<LandingV6 />} />');
  });

  it('Kurzpfade leiten auf die Produktseiten', () => {
    for (const [from, to] of [
      ['/build-studio', '/produkte/build-studio'],
      ['/agent-studio', '/produkte/agent-studio'],
      ['/governance-os', '/produkte/governance-os'],
    ]) {
      expect(APP).toContain(`<Route path="${from}" element={<Navigate to="${to}" replace />} />`);
    }
  });
});
