/**
 * Landing v6 (`/`) und v4 (Referenz/Rückfall unter /design/landing-v4) — nur Aussagen,
 * die die Runtime deckt (Freigabe Dominik, 13.10.2026): Policy-Pack-Zahl folgt dem
 * Status, kein On-Prem-Angebot, Evidence-Ledger ohne Städte-Knoten.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

it('v6 on / names four live packs and marks TISAX/DORA coming soon, as the registry does', () => {
  expect(getImplementation('framework-tisax-dora')?.status).not.toBe('live');
  const v6 = readFileSync(resolve(__dirname, '../../src/components/landing/v6/LandingV6View.tsx'), 'utf8');
  expect(v6).not.toMatch(/SECHS POLICY PACKS|6 POLICY PACKS/i);
  expect(v6).toContain('4 POLICY PACKS LIVE');
  expect(v6).not.toMatch(/·\s*next</);
  expect(v6).toContain('TISAX · Coming Soon');
  expect(v6).toContain('DORA · Coming Soon');
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

it('v6 on / makes no unbacked speed, enforcement or SLA claims', () => {
  const v6 = readFileSync(resolve(__dirname, '../../src/components/landing/v6/LandingV6View.tsx'), 'utf8');
  const hook = readFileSync(resolve(__dirname, '../../src/components/landing/v6/useLandingV6.ts'), 'utf8');
  // Scan-Dauer ist nirgends gemessen oder zugesichert (docs/audit, D-09).
  expect(v6).not.toMatch(/90\s*(Sekunden|s\b)/);
  expect(v6).not.toContain('bis zum ersten Befund');
  // PEP-Default ist der Beobachtungsmodus (AI_GATEWAY_ENFORCEMENT ?? 'shadow').
  expect(v6).not.toContain('Enforcement statt Empfehlung');
  expect(v6).toContain('Beobachtungsmodus als Standard');
  // Enterprise: Wortlaut wie in shared/pricing.ts (badges: 'SLA nach Vereinbarung').
  expect(hook).toContain("'SLA nach Vereinbarung · bis zu 5 Organisationen'");
  expect(`${v6}${hook}`).not.toContain('dedizierter Tenant');
});
