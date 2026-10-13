/**
 * Landing v4 — Referenz/Rückfall unter /design/landing-v4. Nur Aussagen, die die
 * Runtime deckt (Freigabe Dominik, 13.10.2026): Policy-Pack-Zahl folgt dem Status,
 * kein On-Prem-Angebot, Evidence-Ledger ohne Städte-Knoten.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV4 } from '../../src/pages/LandingV4';
import { HERO_FRAMEWORKS, HERO_PACKS_LINE, LEDGER_NODES } from '../../src/components/landing/v4/landing-v4-content';
import { getImplementation } from '../../src/product/implementation-status';
import { resetLangForTests } from '../../src/i18n/useLang';

// Die 3D-Szene braucht WebGL; im DOM-Test genügt, dass sie nicht mountet.
vi.mock('../../src/components/landing/v4/heroEarthScene', () => ({ mountHeroEarth: () => () => {} }));

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetLangForTests();
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/design/landing-v4']}>
      <LandingV4 />
    </MemoryRouter>,
  );

it('counts only live policy packs as live; TISAX/DORA stay coming soon like the registry', () => {
  expect(
    getImplementation('framework-tisax-dora')?.status,
    'TISAX/DORA live? Dann in HERO_FRAMEWORKS auf next=false setzen.',
  ).not.toBe('live');
  expect(HERO_FRAMEWORKS.filter(([, next]) => next).map(([name]) => name)).toEqual(['TISAX', 'DORA']);
  expect(HERO_PACKS_LINE).toBe('4 POLICY PACKS LIVE · TISAX/DORA COMING SOON');

  const { container } = mount();
  expect(container.querySelector('.trust p')).toHaveTextContent(HERO_PACKS_LINE);
  expect(container.textContent).not.toMatch(/SECHS POLICY PACKS|6 POLICY PACKS/i);
});

it('offers no on-prem operation', () => {
  const { container } = mount();
  expect(container.textContent).not.toMatch(/On-Prem/i);
});

it('labels evidence ledger rows by event type, not by city nodes', () => {
  for (const [step, role] of LEDGER_NODES) {
    expect(`${step} ${role}`).not.toMatch(/BERLIN|BRÜSSEL|FRANKFURT|STOCKHOLM|PARIS|WIEN|Node|Knoten/i);
  }
  const { container } = mount();
  expect(container.textContent).not.toMatch(/STOCKHOLM|Evidence Node/);
  expect(container.textContent).toContain('Entscheidung durch Menschen');
});
