/**
 * Design landing previews must render as Preview routes — never replace live `/`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

describe('design landing previews', () => {
  it('registers /design/ledger and /design/tribunal without replacing /', () => {
    const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
    expect(app).toMatch(/path="\/"\s+element=\{<MainLanding/);
    expect(app).toContain('path="/design/ledger"');
    expect(app).toContain('path="/design/tribunal"');
    expect(app).toContain('DesignLedgerLanding');
    expect(app).toContain('DesignTribunalLanding');
  });

  it('uses existing audit funnel and allowed CTAs only', () => {
    for (const file of [
      'src/pages/design/DesignLedgerLanding.tsx',
      'src/pages/design/DesignTribunalLanding.tsx',
    ]) {
      const src = readFileSync(resolve(root, file), 'utf8');
      expect(src).toContain('/audit?domain=');
      expect(src).toContain('HERO_SCAN_CTA_LONG');
      expect(src).toContain('CTA.enterprise');
      expect(src).not.toMatch(/Pilot anfragen|Demo buchen|Termin vereinbaren|Beratung anfragen/);
      expect(src).toMatch(/STATUS_LABEL\.preview/);
      expect(src).not.toContain('HeroEarthBackdrop');
      expect(src).not.toContain('#e4cfa2');
      expect(src).not.toContain('#e8ddc8');
    }
  });

  it('registers both design surfaces as preview in implementation-status', () => {
    const reg = readFileSync(resolve(root, 'src/product/implementation-status.ts'), 'utf8');
    expect(reg).toContain("id: 'design-landing-ledger'");
    expect(reg).toContain("id: 'design-landing-tribunal'");
    expect(reg).toContain("route: '/design/ledger'");
    expect(reg).toContain("route: '/design/tribunal'");
    expect(reg).toMatch(/id: 'public-landing'[\s\S]*?status: 'live'/);
  });
});
