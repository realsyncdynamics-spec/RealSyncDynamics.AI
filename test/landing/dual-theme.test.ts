/**
 * Dominik Dark/Gold public `/` — photoreal Governance Sphere (Sept 2026 reference).
 * Replaces the later Titan/Nacht dual-theme contract.
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
  HERO_SCAN_CTA_LABEL,
} from '../../src/components/governance-frontend/hero-content';

const root = resolve(__dirname, '../..');
const landing = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
const theme = readFileSync(resolve(root, 'src/components/landing/landing-theme.ts'), 'utf8');
const scene = readFileSync(
  resolve(root, 'src/components/governance-frontend/GovernanceSphereScene.tsx'),
  'utf8',
);

describe('Landing Dominik Dark/Gold — Sphere restore', () => {
  it('keeps Dominik gold tokens on the public theme', () => {
    expect(theme).toContain("#05070b");
    expect(theme).toContain("#e4cfa2");
    expect(theme).toContain("#e8ddc8");
    expect(theme).toContain('Playfair Display');
    expect(theme).toContain('DM Mono');
  });

  it('wires the interactive Governance Sphere on public /', () => {
    expect(landing).toContain('GovernanceSphereHost');
    expect(landing).toContain('landing-context');
    expect(landing).not.toContain('EuropeReliefBackdrop');
    expect(landing).not.toContain('useGaTheme');
    expect(landing).not.toContain('data-ga-theme');
    expect(scene).toContain('PhotorealEarthMesh');
    expect(scene).toContain("#e8c98a");
  });

  it('renders Dominik H1 + scan CTA copy', () => {
    render(createElement(MemoryRouter, null, createElement(MainLanding)));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      HERO_HEADLINE_TEST_SUBSTRING,
    );
    expect(screen.getAllByText(HERO_SCAN_CTA_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText(HERO_DASHBOARD_CTA_LABEL).length).toBeGreaterThan(0);
  });
});
