/**
 * Landing CTAs müssen auf echte Infrastruktur zeigen — keine toten Buttons,
 * keine Fake-Erfolgsalerts, keine erfundenen /scan-Entry-Points wenn /audit kanonisch ist.
 *
 * Dominik Dark/Gold `/`: PublicDarkHeader LINKS + MainLanding form → /audit.
 * Ecosystem IA remains in public-nav.ts for deeper menus / future chrome.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_NAV_GROUPS } from '../../src/config/public-nav';

const root = resolve(__dirname, '../..');
const mainLanding = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
const platformSection = readFileSync(
  resolve(root, 'src/components/landing/PlatformCapabilitiesSection.tsx'),
  'utf8',
);
const header = readFileSync(resolve(root, 'src/components/landing/PublicDarkHeader.tsx'), 'utf8');
const publicNav = readFileSync(resolve(root, 'src/config/public-nav.ts'), 'utf8');
const channel = readFileSync(resolve(root, 'src/components/landing/LandingChannelTools.tsx'), 'utf8');
const scanStart = readFileSync(
  resolve(root, 'src/pages/product-entry-points/ScanStartPage.tsx'),
  'utf8',
);
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const navShell = header + publicNav + mainLanding;

describe('Landing ↔ Infrastruktur', () => {
  it('Header-Scan bleibt kanonisch /audit', () => {
    expect(header).toContain('to="/audit"');
    expect(header).toContain("to: '/governance-runtime'");
    expect(header).toContain("to: '/welcome'");
    expect(header).toContain('HERO_SCAN_CTA_LABEL');
    expect(header).toContain("from '../governance-frontend/hero-content'");
    expect(navShell).toContain('/audit');
  });

  it('Produkt-IA hat Ecosystem-Sections mit echten Routen (public-nav SSOT)', () => {
    expect(publicNav).toContain('sections:');
    expect(publicNav).toContain('Agent Governance');
    expect(publicNav).toContain('/agent-governance');
    expect(publicNav).toContain('/welcome?next=/app/evidence');
    expect(PUBLIC_NAV_GROUPS.some((g) => g.id === 'produkt')).toBe(true);
  });

  it('every Produkt leaf hits a real path (no bare #)', () => {
    const produkt = PUBLIC_NAV_GROUPS.find((g) => g.id === 'produkt');
    const leaves = [
      ...(produkt?.children ?? []),
      ...(produkt?.sections?.flatMap((s) => s.children) ?? []),
    ];
    for (const leaf of leaves) {
      expect(leaf.to.startsWith('#') && leaf.to.length < 3, leaf.label).toBe(false);
      expect(leaf.to.includes('http') || leaf.to.startsWith('/'), leaf.to).toBe(true);
    }
  });

  it('Activation-Route ist hinter AppGate verdrahtet', () => {
    expect(app).toContain('path="/app/activation"');
    expect(app).toContain('GovernanceActivationView');
    expect(app).toMatch(/path="\/app\/activation"[^>]*AppGate/);
  });

  it('Dominik landing CTAs zeigen Audit + Titan-Relief, keine Demo-Buchung', () => {
    expect(mainLanding).toContain('EuropeReliefBackdrop');
    expect(mainLanding).toContain('to="/audit"');
    expect(mainLanding).toContain('id="scan"');
    // Die Live-Capability-Liste kommt weiter aus dem Registry, seit dem
    // Titan-Redesign über `PlatformCapabilitiesSection` statt inline.
    expect(mainLanding).toContain('PlatformCapabilitiesSection');
    expect(platformSection).toContain('PLATFORM_LIVE_ITEMS');
    expect(mainLanding).toContain('HERO_SCAN_CTA_LABEL');
    expect(mainLanding).toContain('HERO_DASHBOARD_CTA_LABEL');
    expect(mainLanding).not.toContain('Demo buchen');
    expect(mainLanding).not.toContain('GovernanceSphereHost');
    expect(mainLanding).not.toContain('HeroEuropeSunrise');
  });

  it('Channel-Tools auf / sind ehrlich verdrahtet (keine Fake-Alerts)', () => {
    expect(mainLanding).toContain('LandingChannelTools');
    expect(channel).toContain('/chatbot/start');
    expect(channel).not.toContain('alert(');
  });

  it('/scan/start leitet auf /audit statt Fake-Alert', () => {
    expect(scanStart).toContain('/audit');
    expect(scanStart).not.toContain('alert(');
  });
});
