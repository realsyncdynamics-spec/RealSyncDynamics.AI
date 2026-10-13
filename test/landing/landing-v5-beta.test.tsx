import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BETA, betaSignupHref, isBetaFlagOn, isBetaPlan } from '../../src/config/beta';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('Landing v5 + Beta-Testphase', () => {
  it('Beta ist per Default AUS (bis WP-3 beta-enroll existiert)', () => {
    expect(BETA.active).toBe(false);
    expect(isBetaPlan('starter')).toBe(false);
    expect(isBetaPlan('growth_monthly')).toBe(false);
    expect(isBetaPlan('agency')).toBe(false);
  });

  it('Flag: nur explizites on/true schaltet die Beta ein', () => {
    for (const v of ['on', 'ON', 'true', ' True ']) expect(isBetaFlagOn(v), v).toBe(true);
    for (const v of [undefined, null, '', 'off', 'false', '0', '1', 'yes', 'beta']) expect(isBetaFlagOn(v), String(v)).toBe(false);
  });

  it('Beta-Einstieg führt über /welcome (Auth) ins Dashboard, nie auf fremde Hosts', () => {
    const href = betaSignupHref('growth', 'test');
    expect(href.startsWith('/welcome?')).toBe(true);
    const q = new URLSearchParams(href.split('?')[1]);
    expect(q.get('beta')).toBe('1');
    expect(q.get('next')?.startsWith('/app/dashboard')).toBe(true);
  });

  it('Hero nutzt v4-Texte (i18n) und v2-Buttons, kein zweites Preis-Schema', () => {
    const hero = read('src/components/landing/v5/HeroV5.tsx');
    for (const key of ['v4HeroTitleA', 'v4HeroTitleB', 'v4HeroTitleEm', 'v4HeroLede1', 'v4HeroPrimaryCta']) {
      expect(hero).toContain(key);
    }
    expect(hero).toContain('lv2-btn--gold');
    expect(hero).toContain('planById');
    expect(hero).not.toMatch(/\b(79|249|699)\s?€/);
    expect(hero).toContain("import('./heroEuropeNetwork3D')");
  });

  it('Kein Build-/Deploy-Config erzwingt VITE_BETA_PHASE=on', () => {
    for (const f of ['.env.example', 'wrangler.toml', 'vite.config.ts', 'Dockerfile.frontend']) {
      expect(read(f), f).not.toMatch(/VITE_BETA_PHASE\s*[=:]\s*["']?(on|true)/i);
    }
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

  it('Checkout-Umleitung hängt an isBetaPlan → bei Beta aus kein Redirect', () => {
    expect(isBetaPlan('starter')).toBe(false);
  });
});

const COPY = [/alle Funktionen kostenlos/i, /Testen Sie alles/, /Zahlen Sie nichts/, /0\s*€/];

async function renderV5(flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv('VITE_BETA_PHASE', flag as string);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  const beta = await import('../../src/config/beta');
  const { HeroV5 } = await import('../../src/components/landing/v5/HeroV5');
  const { BetaRibbon, V5BetaProgram } = await import('../../src/components/landing/v5/V5Sections');
  const view = render(
    <MemoryRouter>
      <BetaRibbon />
      <HeroV5 />
      <V5BetaProgram />
    </MemoryRouter>,
  );
  return { beta, view };
}

describe('Landing v5 — Beta an/aus (gerendert)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('Beta aus (Default): keine Gratis-Versprechen, keine 0-€-Preise, Tarife → Checkout', async () => {
    const { beta, view } = await renderV5(undefined);
    expect(beta.BETA.active).toBe(false);
    const text = view.container.textContent ?? '';
    for (const re of COPY) expect(text).not.toMatch(re);
    expect(view.container.querySelector('s')).toBeNull();
    const growth = view.container.querySelector('[data-hero-cta="plan-growth"]');
    expect(growth?.getAttribute('href')).toMatch(/^\/checkout\//);
    expect(view.container.querySelector('a[href^="/welcome?"]')).toBeNull();
  });

  it('Beta an (VITE_BETA_PHASE=on): Beta-Texte sichtbar, Tarife → Registrierung', async () => {
    const { beta, view } = await renderV5('on');
    expect(beta.BETA.active).toBe(true);
    expect(beta.isBetaPlan('growth_monthly')).toBe(true);
    expect(beta.isBetaPlan('enterprise')).toBe(false);
    const text = view.container.textContent ?? '';
    expect(text).toMatch(/alle Funktionen kostenlos/i);
    expect(text).toMatch(/Zahlen Sie nichts/);
    expect(view.container.querySelector('s')).not.toBeNull();
    const growth = view.container.querySelector('[data-hero-cta="plan-growth"]');
    expect(growth?.getAttribute('href')).toMatch(/^\/welcome\?/);
  });
});
