import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MainLanding } from '../../src/pages/MainLanding';

const root = resolve(__dirname, '../..');
const landing = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
const themeHook = readFileSync(resolve(root, 'src/components/landing/use-ga-theme.ts'), 'utf8');
const backdrop = readFileSync(resolve(root, 'src/components/landing/EuropeReliefBackdrop.tsx'), 'utf8');
const status = readFileSync(resolve(root, 'src/components/landing/GovernanceStatusBar.tsx'), 'utf8');

describe('Landing dual frontend — Titan / Nacht', () => {
  it('exposes both themes and persists the choice', () => {
    expect(themeHook).toContain("'titan'");
    expect(themeHook).toContain("'night'");
    expect(themeHook).toContain('rsd-landing-theme');
    expect(themeHook).toContain("DEFAULT_THEME: GaTheme = 'titan'");
  });

  it('wires the switch on the public homepage', () => {
    expect(landing).toContain('useGaTheme');
    expect(landing).toContain('data-ga-theme');
    expect(landing).toContain('EuropeReliefBackdrop');
    expect(landing).toContain('GovernanceStatusBar');
    expect(status).toContain('ThemeSwitch');
    expect(landing).not.toContain('GovernanceSphereHost');
  });

  it('renders one Europe visual per theme', () => {
    expect(backdrop).toContain("theme === 'night'");
    expect(backdrop).toContain('/europe-globe.webp');
    expect(backdrop).toContain('europe-night-photo');
    expect(backdrop).toContain('europe-relief-titan');
  });

  it('switches the rendered hero visual at runtime', () => {
    render(
      createElement(MemoryRouter, null, createElement(MainLanding)),
    );

    expect(document.querySelector('[data-ga-theme="titan"]')).toBeTruthy();
    expect(document.querySelector('[data-hero-visual="europe-relief-titan"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /nacht/i }));

    expect(document.querySelector('[data-ga-theme="night"]')).toBeTruthy();
    expect(document.querySelector('[data-hero-visual="europe-night-photo"]')).toBeTruthy();
  });
});
