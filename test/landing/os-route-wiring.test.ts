/**
 * Landing CTAs müssen auf echte Infrastruktur zeigen — keine toten Buttons,
 * keine Fake-Erfolgsalerts, keine erfundenen /scan-Entry-Points wenn /audit kanonisch ist.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const mainLanding = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
const header = readFileSync(resolve(root, 'src/components/landing/PublicDarkHeader.tsx'), 'utf8');
const channel = readFileSync(resolve(root, 'src/components/landing/LandingChannelTools.tsx'), 'utf8');
const scanStart = readFileSync(
  resolve(root, 'src/pages/product-entry-points/ScanStartPage.tsx'),
  'utf8',
);
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');

describe('Landing ↔ Infrastruktur', () => {
  it('Header-Scan bleibt kanonisch /audit', () => {
    expect(header).toContain('to="/audit"');
    expect(header).toContain("to: '/governance-runtime'");
    expect(header).toContain("to: '/welcome'");
  });

  it('Evidence und Module öffnen OS-Flächen (nicht nur Hash-Anker)', () => {
    expect(header).toContain("to: '/app/evidence'");
    expect(header).toContain("to: '/app/modules'");
    expect(header).toContain('osEntry: true');
  });

  it('Activation-Route ist hinter AppGate verdrahtet', () => {
    expect(app).toContain('path="/app/activation"');
    expect(app).toContain('GovernanceActivationView');
    expect(app).toMatch(/path="\/app\/activation"[^>]*AppGate/);
  });

  it('Landing enthält Governance Activation Section und echte CTAs', () => {
    expect(mainLanding).toContain('GovernanceActivationSection');
    expect(mainLanding).toContain('to="/governance-runtime"');
    expect(mainLanding).toContain('to="/app/evidence"');
    expect(mainLanding).toContain('to="/app/activation"');
    expect(mainLanding).toContain('to="/audit"');
  });

  it('Channel-Tools nutzen Live-Routen oder Warteliste — kein Fake-Success', () => {
    expect(channel).toContain('/app/bots?channel=whatsapp');
    expect(channel).toContain('/handwerk-website');
    expect(channel).toContain('/claude-code-optimizer');
    expect(channel).toContain('/warteliste');
    expect(channel).not.toContain('alert(');
  });

  it('/scan/start leitet auf /audit statt Fake-Alert', () => {
    expect(scanStart).toContain('/audit');
    expect(scanStart).not.toContain('alert(');
  });
});
