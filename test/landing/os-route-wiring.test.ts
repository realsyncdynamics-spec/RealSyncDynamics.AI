/**
 * Landing CTAs müssen auf echte Infrastruktur zeigen — keine toten Buttons,
 * keine Fake-Erfolgsalerts, keine erfundenen /scan-Entry-Points wenn /audit kanonisch ist.
 *
 * Nav destinations live in public-nav.ts (PublicDarkHeader submenus).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
const navShell = header + publicNav;

describe('Landing ↔ Infrastruktur', () => {
  it('Header-Scan bleibt kanonisch /audit', () => {
    expect(navShell).toContain("to: '/audit'");
    expect(navShell).toContain("to: '/governance-runtime'");
    expect(navShell).toContain("to: '/welcome'");
    expect(header).toContain('PUBLIC_CTA');
  });

  it('Evidence und Module öffnen echte Ziele (OS oder Tools)', () => {
    expect(publicNav).toContain('/welcome?next=/app/evidence');
    expect(publicNav).toContain("to: '/#tools'");
    expect(publicNav).toContain('/chatbot/start');
    expect(publicNav).toContain('/welcome?next=/build');
    expect(header).toContain('PUBLIC_NAV_GROUPS');
  });

  it('Activation-Route ist hinter AppGate verdrahtet', () => {
    expect(app).toContain('path="/app/activation"');
    expect(app).toContain('GovernanceActivationView');
    expect(app).toMatch(/path="\/app\/activation"[^>]*AppGate/);
  });

  it('Landing enthält Governance Activation Section und echte CTAs', () => {
    expect(mainLanding).toContain('GovernanceActivationSection');
    expect(mainLanding).toContain('/welcome?next=/app/dashboard');
    expect(mainLanding).toContain('to="/app/evidence"');
    expect(mainLanding).toContain('to="/app/activation"');
    expect(mainLanding).toContain('to="/audit"');
  });

  it('Channel-Tools nutzen IA-Routen oder Warteliste — kein Fake-Success', () => {
    expect(channel).toContain('/chatbot/start');
    expect(channel).toContain('/phonebot/start');
    expect(channel).toContain('/build');
    expect(channel).toContain('/claude-code-optimizer');
    expect(channel).toContain('/warteliste');
    expect(channel).not.toContain('alert(');
  });

  it('/scan/start leitet auf /audit statt Fake-Alert', () => {
    expect(scanStart).toContain('/audit');
    expect(scanStart).not.toContain('alert(');
  });
});
