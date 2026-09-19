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
  HERO_DASHBOARD_CTA_LABEL,
  HERO_HEADLINE_TEST_SUBSTRING,
  HERO_PROOF_CHIPS,
  HERO_SCAN_CTA_LABEL,
  HERO_SCAN_CTA_LONG,
} from '../../src/components/governance-frontend/hero-content';

const root = resolve(__dirname, '../..');
const landing = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
const theme = readFileSync(resolve(root, 'src/components/landing/landing-theme.ts'), 'utf8');
const header = readFileSync(resolve(root, 'src/components/landing/PublicDarkHeader.tsx'), 'utf8');
const network = readFileSync(resolve(root, 'src/components/landing/EuropeNetworkHero.tsx'), 'utf8');

describe('Landing Design-Lock v2 — True Black / Cyan / Gold-VIP', () => {
  it('traegt die Tokens des Design-Lock v2', () => {
    // Freigabe Dominik, 2026-09-13. Cyan traegt die Handlung, Gold die
    // VIP-Stufe — beide nebeneinander sind Absicht, kein Rest aus v1.
    expect(theme, 'True Black fehlt').toContain('#000000');
    expect(theme, 'Cyan-Akzent fehlt').toContain('#22c3e6');
    expect(theme, 'City-Light-Gold (LANDING_ACCENT_VIP) fehlt').toContain('#f2c98a');
    expect(theme).toContain('Playfair Display');
  });

  it('traegt die Goldwerte aus v1 nicht mehr als Hauptakzent', () => {
    // #e8c98a / #e4cfa2 bleiben als weiche Akzente bestehen; das alte
    // Primaergold und der alte Grundton duerfen nicht zurueckkommen.
    expect(theme, 'v1-Primaergold #d6ad68 ist zurueck').not.toContain('#d6ad68');
    expect(theme, 'v1-Grundton #0a0a0b ist zurueck').not.toContain('#0a0a0b');
  });

  it('uses static Europe network — not interactive sphere', () => {
    expect(landing).toContain('EuropeNetworkHero');
    expect(landing).not.toContain('GovernanceSphereHost');
    expect(landing).not.toContain('useGaTheme');
    expect(landing).not.toContain('EuropeReliefBackdrop');
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

  it('renders Replit H1 + CTAs + trust chips', () => {
    render(createElement(MemoryRouter, null, createElement(MainLanding)));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/AI Compliance/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Operations OS/);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/für Europa/);
    expect(screen.getAllByText(HERO_SCAN_CTA_LONG).length).toBeGreaterThan(0);
    expect(screen.getAllByText(HERO_DASHBOARD_CTA_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText(HERO_SCAN_CTA_LABEL).length).toBeGreaterThan(0);
    for (const chip of HERO_PROOF_CHIPS) {
      expect(screen.getAllByText(chip).length).toBeGreaterThan(0);
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
