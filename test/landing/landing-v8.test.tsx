/**
 * Landing v8 (/design/landing-v8, Vorschau) — Obsidian/Titan mit 3D-Logo.
 * Texte aus Landing v5 (i18n `v4Hero*`, LOOP_NODES, Beta-Schalter),
 * Preise aus der Pricing-SSoT, Roadmap aus implementation-status.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV8 } from '../../src/pages/LandingV8';
import { BETA, BETA_PUBLIC_OFFER } from '../../src/config/beta';
import { LOOP_NODES } from '../../src/components/landing/v4/landing-v4-content';
import { formatPriceEur, planById } from '@/shared/pricing';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  // jsdom hat kein WebGL: Die Seite muss beim flachen Zeichen bleiben.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/design/landing-v8']}>
      <LandingV8 />
    </MemoryRouter>,
  );

it('is a preview route; v6 stays on /', () => {
  const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
  expect(app).toMatch(/path="\/"\s+element=\{<LandingV6/);
  expect(app).toMatch(/path="\/design\/landing-v8" element=\{<LandingV8 \/>\}/);
  const seo = readFileSync(resolve(__dirname, '../../src/config/seo.ts'), 'utf8');
  expect(seo).toMatch(/'\/design\/landing-v8': \{[\s\S]*?noIndex: true/);
});

it('uses the v5 hero texts with exactly one H1', () => {
  mount();
  const h1 = screen.getAllByRole('heading', { level: 1 });
  expect(h1).toHaveLength(1);
  expect(h1[0]).toHaveTextContent('Risiken auf Ihrer Website und bei KI erkennen und nachweisen.');
  for (const [, title] of LOOP_NODES) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
});

it('falls back to the flat logo without WebGL', async () => {
  const { container } = mount();
  const stage = container.querySelector('.lv8-stage') as HTMLElement;
  await vi.waitFor(() => expect(stage.dataset.gl).toBe('off'));
  expect(stage.querySelector('svg')).not.toBeNull();
});

it('prices plans from the SSoT and respects the beta offer', () => {
  const { container } = mount();
  for (const id of ['starter', 'growth', 'agency'] as const) {
    const plan = planById(id);
    const card = within(container.querySelector(`[data-plan="${id}"]`) as HTMLElement);
    expect(card.getByText(plan.name)).toBeInTheDocument();
    expect(card.getByText(formatPriceEur(plan.price.monthlyEur))).toBeInTheDocument();
    const href = card.getByRole('link').getAttribute('href') ?? '';
    expect(href).toContain(BETA_PUBLIC_OFFER ? '/welcome?' : '/checkout/');
  }
  const enterprise = within(container.querySelector('[data-plan="enterprise"]') as HTMLElement);
  expect(enterprise.getByRole('link', { name: 'Enterprise anfragen' })).toHaveAttribute(
    'href',
    expect.stringContaining('/contact-sales?tier=enterprise'),
  );
});

it('keeps allowed CTAs only and drops the unproven EU-hosting promise', () => {
  const { container } = mount();
  expect(container.textContent).not.toMatch(/Pilot anfragen|Demo buchen|Termin vereinbaren|Beratung anfragen/);
  expect(container.textContent).not.toContain('EU-Hosting');
  if (BETA.active) expect(screen.getByRole('heading', { name: 'Testen Sie alles. Zahlen Sie nichts.' })).toBeInTheDocument();
  const footer = within(document.querySelector('footer') as HTMLElement);
  expect(footer.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
  expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz');
});
