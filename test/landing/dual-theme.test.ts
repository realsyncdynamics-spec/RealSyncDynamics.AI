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

describe('Landing Replit Dark/Gold — Europe-network', () => {
  it('keeps Dark/Gold amber tokens', () => {
    expect(theme).toContain('#0a0a0b');
    expect(theme).toContain('#d6ad68');
    expect(theme).toContain('#e8c98a');
    expect(theme).toContain('Playfair Display');
  });

  it('uses static Europe network — not interactive sphere', () => {
    expect(landing).toContain('EuropeNetworkHero');
    expect(landing).not.toContain('GovernanceSphereHost');
    // Der Farbmodus laeuft ueber `useLandingMode` (Gold/Cyan, nur Tonung).
    // `useGaTheme` ist die alte OS-Variante mit eigener Typografie und
    // eigenem Layout — die gehoert nicht auf die Startseite.
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
