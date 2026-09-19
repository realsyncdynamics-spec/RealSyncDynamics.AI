/**
 * Replit SSOT `/` — Dark/Gold Europe-network (static), Free Audit CTAs.
 */
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MainLanding } from '../../src/pages/MainLanding';
import {
  HERO_HEADLINE_TEST_SUBSTRING,
  HERO_INFRA_LINES,
  HERO_OPERATING_LOOP,
  HERO_PLAN_ANCHOR_FREE,
  HERO_SCAN_CTA_LABEL,
} from '../../src/components/governance-frontend/hero-content';
import { tierById } from '../../src/config/pricing';

const root = resolve(__dirname, '../..');
const landing = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
const theme = readFileSync(resolve(root, 'src/components/landing/landing-theme.ts'), 'utf8');
const header = readFileSync(resolve(root, 'src/components/landing/PublicDarkHeader.tsx'), 'utf8');
const network = readFileSync(resolve(root, 'src/components/landing/EuropeNetworkHero.tsx'), 'utf8');
const titanHero = readFileSync(resolve(root, 'src/components/landing/HeroTitanium.tsx'), 'utf8');

describe('Landing Replit Dark/Gold — Europe-network', () => {
  it('keeps Dark/Gold amber tokens', () => {
    expect(theme).toContain('#0a0a0b');
    expect(theme).toContain('#d6ad68');
    expect(theme).toContain('#e8c98a');
    expect(theme).toContain('Playfair Display');
  });

  it('uses static Europe network — not interactive sphere', () => {
    // Der Hero sitzt seit der Titan-Umsetzung in HeroTitanium, nicht mehr
    // inline in MainLanding — die Backdrop-Zusicherung wandert mit.
    expect(titanHero).toContain('EuropeNetworkHero');
    expect(landing).toContain('HeroTitanium');
    expect(landing).not.toContain('GovernanceSphereHost');
    expect(landing).not.toContain('useGaTheme');
    expect(titanHero).not.toContain('EuropeReliefBackdrop');
    expect(network).toContain('europe-network-static');
    expect(network).toContain('data-hero-interactive="false"');
    expect(network).toContain('/europe-globe.webp');
  });

  it('locks Replit header chrome', () => {
    expect(header).toContain('REALSYNCDYNAMICS.AI');
    expect(header).toContain('Produkt');
    expect(header).toContain('Evidence');
    expect(header).toContain('Preise');
    expect(header).toContain('HERO_SCAN_CTA_LABEL');
    expect(header).toContain('to="/audit"');
  });

  it('renders Titan H1 + Operating Loop + Infrastrukturzeilen + Plan-Anker', () => {
    render(createElement(MemoryRouter, null, createElement(MainLanding)));
    const h1 = screen.getByRole('heading', { level: 1 }).textContent ?? '';
    expect(h1).toMatch(/AI Compliance/);
    expect(h1).toMatch(/Operations OS/);
    expect(h1).toMatch(/for Europe/);

    // Operating Loop als Pfeilkette, nicht als Satzreihe.
    expect(screen.getAllByText(HERO_OPERATING_LOOP).length).toBeGreaterThan(0);

    // Jede Infrastrukturzeile steht als eine Zeile mit " · " getrennt.
    for (const line of HERO_INFRA_LINES) {
      expect(screen.getAllByText(line.join(' · ')).length).toBeGreaterThan(0);
    }

    // Plan-Anker: Gratis-Chip plus die drei Tarife aus der Preis-SSoT.
    expect(screen.getAllByText(HERO_PLAN_ANCHOR_FREE).length).toBeGreaterThan(0);
    for (const id of ['starter', 'growth', 'agency'] as const) {
      const tier = tierById(id);
      expect(tier, `Tarif ${id} fehlt in der Preis-SSoT`).toBeTruthy();
      expect(screen.getAllByText(`${tier!.priceEur}€`).length).toBeGreaterThan(0);
    }

    expect(HERO_HEADLINE_TEST_SUBSTRING).toBe('AI Compliance');
  });

  it('ships KPI strip + Das Betriebssystem below the fold', () => {
    expect(landing).toContain('SYSTEME IM SCOPE');
    expect(landing).toContain('DAS BETRIEBSSYSTEM');
    expect(landing).toContain('Discover');
    expect(landing).toContain('Classify');
    expect(landing).toContain('Enforce');
    expect(landing).toContain('Prove');
    expect(landing).toContain('data-demo-kpis');
  });
});
