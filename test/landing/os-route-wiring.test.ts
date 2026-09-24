/**
 * Replit Dark/Gold `/` — Europe-network hero + Free Audit → /audit.
 * AppGate / chunk-split security from #1363 stays intact on app routes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_NAV_GROUPS } from '../../src/config/public-nav';

const root = resolve(__dirname, '../..');
const mainLanding = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
// Hero-Markup liegt seit der Titan-Umsetzung in HeroTitanium.
const titanHero = readFileSync(resolve(root, 'src/components/landing/HeroTitanium.tsx'), 'utf8');
// Die Runtime-Stationen sitzen seit der Entwurfsumsetzung in einer eigenen
// Sektion, nicht mehr als „DAS BETRIEBSSYSTEM" inline in MainLanding.
const runtimeStations = readFileSync(
  resolve(root, 'src/components/landing/GovernanceRuntimeSection.tsx'),
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

  it('Replit landing: Europe-network hero + Governance-Scan/Audit-Trail CTAs', () => {
    expect(titanHero).toContain('EuropeNetworkHero');
    expect(mainLanding).toContain('PLATFORM_LIVE_ITEMS');
    expect(titanHero).toContain('id="audit-cta"');
    expect(titanHero).toContain('data-hero-cta="audit"');
    expect(titanHero).toContain('data-hero-cta="audit-trail"');
    expect(titanHero.match(/data-hero-cta=/g)?.length).toBe(2);
    expect(mainLanding).not.toContain('data-hero-cta');
    expect(mainLanding).toContain('to="/audit"');
    expect(mainLanding).toContain('GovernanceRuntimeSection');
    expect(runtimeStations).toContain('GOVERNANCE RUNTIME');
    expect(mainLanding).not.toContain('Demo buchen');
    expect(mainLanding).not.toContain('GovernanceSphereHost');
    expect(mainLanding).not.toContain('HeroEuropeSunrise');
    expect(mainLanding).not.toContain('useGaTheme');
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
