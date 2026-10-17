import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BETA, betaSignupHref, isBetaPlan } from '../../src/config/beta';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Landing v5 + Beta-Testphase', () => {
  it('Beta ist per Default aktiv und deckt nur Self-Service-Pläne ab', () => {
    expect(BETA.active).toBe(true);
    expect(isBetaPlan('starter')).toBe(true);
    expect(isBetaPlan('growth_monthly')).toBe(true);
    expect(isBetaPlan('agency')).toBe(true);
    expect(isBetaPlan('enterprise')).toBe(false);
    expect(isBetaPlan(undefined)).toBe(false);
  });

  it('Beta-Einstieg führt über /welcome (Auth) ins Dashboard, nie auf fremde Hosts', () => {
    const href = betaSignupHref('growth', 'test');
    expect(href.startsWith('/welcome?')).toBe(true);
    const q = new URLSearchParams(href.split('?')[1]);
    expect(q.get('beta')).toBe('1');
    expect(q.get('next')?.startsWith('/app/dashboard')).toBe(true);
  });

  it('Hero nutzt H1/CTA aus i18n, v5-Texte und v2-Buttons, kein zweites Preis-Schema', () => {
    const hero = read('src/components/landing/v5/HeroV5.tsx');
    for (const key of ['v4HeroTitleA', 'v4HeroTitleB', 'v4HeroTitleEm', 'v4HeroPrimaryCta']) {
      expect(hero).toContain(key);
    }
    // Lede/Nebentexte kommen aus der v5-Textdatei (DE/EN).
    expect(hero).toContain('V5_COPY');
    expect(hero).toContain('lv2-btn--gold');
    expect(hero).toContain('planById');
    expect(hero).not.toMatch(/\b(79|249|699)\s?€/);
    expect(hero).toContain("import('./heroEuropeNetwork3D')");
  });

  it('Checkout leitet Beta-Pläne in die Registrierung um, mit bewusstem Kauf-Ausweg', () => {
    const co = read('src/features/billing/CheckoutPage.tsx');
    expect(co).toContain('isBetaPlan(plan.id)');
    expect(co).toContain("searchParams.get('purchase') !== '1'");
  });

  it('Roadmap liest nur die Implementation-Status-SSoT', () => {
    const s = read('src/components/landing/v5/V5Sections.tsx');
    expect(s).toContain('ROADMAP_PREVIEW_ITEMS');
    expect(s).not.toMatch(/Vollständige KI-Governance|voll funktionsfähig|vollständig verfügbar/);
  });
});
