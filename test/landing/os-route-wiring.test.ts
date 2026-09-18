/**
 * Dominik Dark/Gold `/` with Governance Sphere + canonical /audit funnel.
 * AppGate / chunk-split security from #1363 stays intact on app routes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_NAV_GROUPS } from '../../src/config/public-nav';

const root = resolve(__dirname, '../..');
const mainLanding = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
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
    expect(header).toContain('/governance-runtime');
    expect(header).toContain('/welcome');
    expect(header).toContain('HERO_SCAN_CTA_LABEL');
    expect(navShell).toContain('/audit');
  });

  it('Produkt-IA hat Ecosystem-Sections mit echten Routen (public-nav SSOT)', () => {
    expect(publicNav).toContain('sections:');
    expect(publicNav).toContain('Agent Governance');
    expect(publicNav).toContain('/agent-governance');
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

  it('Dominik landing: Dark/Gold Sphere hero + Audit-CTA', () => {
    expect(mainLanding).toContain('GovernanceSphereHost');
    expect(mainLanding).toContain('LANDING_ACCENT');
    expect(mainLanding).toContain('PLATFORM_LIVE_ITEMS');
    expect(mainLanding).toContain('id="audit-cta"');
    expect(mainLanding).toContain('data-hero-cta="audit"');
    expect(mainLanding.match(/data-hero-cta/g)?.length).toBe(1);
    expect(mainLanding).toContain('/audit?domain=${encodeURIComponent(value)}');
    expect(mainLanding).not.toContain('Demo buchen');
    expect(mainLanding).not.toContain('EuropeReliefBackdrop');
    expect(mainLanding).not.toContain('useGaTheme');
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
