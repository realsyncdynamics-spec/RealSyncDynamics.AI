/**
 * Landing v7 (/design/landing-v7, Vorschau) — Design-Artefakt Titan/Nacht. Optik aus dem
 * Artefakt, Aussagen aus SSoT und Registry: Beta-/Listenpreise, Enterprise
 * „Auf Anfrage“, TISAX/DORA Coming Soon, Status aus implementation-status.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV7 } from '../../src/pages/LandingV7';
import { BETA } from '../../src/config/beta';
import { tierById, tierPriceLabel } from '../../src/config/pricing';
import { CHANNEL_TOOLS } from '../../src/components/landing/LandingChannelTools';
import { getImplementation, PLATFORM_LIVE_ITEMS, ROADMAP_PREVIEW_ITEMS } from '../../src/product/implementation-status';
import { formatPriceEur, PLANS } from '@/shared/pricing';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  // jsdom zeichnet kein Canvas; die Karte muss das aushalten.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mount = (path = '/design/landing-v7') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LandingV7 />
    </MemoryRouter>,
  );

const BETA_OFFER = BETA.active && BETA.publicOffer;

it('stays reachable as preview; v6 is the start page again', () => {
  const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
  expect(app).toMatch(/path="\/"\s+element=\{<LandingV6/);
  expect(app).toMatch(/path="\/design\/landing-v7" element=\{<LandingV7 \/>\}/);
  expect(app).toMatch(/path="\/design\/landing-v6" element=\{<LandingV6 \/>\}/);
});

it('has one H1 with spaced words and the registry CTA label', () => {
  mount();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI Compliance Operations OS for Europe');
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  // Footer-Links wie auf v6 (E2E FE-004 prüft /impressum und /datenschutz).
  const footer = within(document.querySelector('footer') as HTMLElement);
  expect(footer.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
  expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz');
});

it('prices plans from the SSoT and respects the beta offer', () => {
  const { container } = mount();
  const pricing = within(container.querySelector('#pricing') as HTMLElement);
  for (const id of ['starter', 'growth', 'agency']) {
    const plan = PLANS.find((p) => p.id === id);
    if (!plan) throw new Error(`Plan ${id} fehlt in der SSoT`);
    const card = pricing.getByText(plan.name.toUpperCase()).closest('article') as HTMLElement;
    const amount = card.querySelector('.lv7-amt')?.textContent ?? '';
    if (BETA_OFFER) {
      expect(amount).toContain(formatPriceEur(0));
      expect(card.querySelector('s')?.textContent).toContain(formatPriceEur(plan.price.monthlyEur));
      expect(within(card).getByRole('link').getAttribute('href')).toMatch(/^\/welcome\?/);
    } else {
      expect(amount).toContain(formatPriceEur(plan.price.monthlyEur));
    }
  }
});

it('shows the Enterprise price only via tierPriceLabel and keeps TISAX/DORA coming soon', () => {
  const { container } = mount();
  const tier = tierById('enterprise');
  if (!tier) throw new Error('Enterprise fehlt in der SSoT');
  // Folgt der SSoT: „Auf Anfrage“, solange priceOnRequest gilt, sonst der Festpreis.
  expect(container.textContent).toContain(tierPriceLabel(tier));
  if (tier.priceOnRequest) expect(container.textContent).not.toContain(tier.priceString);
  expect(getImplementation('framework-tisax-dora')?.status).not.toBe('live');
  expect(container.textContent).not.toMatch(/sechs Rahmenwerke|TISAX und DORA als aktive/);
  expect(container.textContent).toMatch(/TISAX und DORA: Coming Soon/);
});

it('takes platform, tools and roadmap status from the registry', () => {
  const { container } = mount();
  const platform = within(container.querySelector('#platform') as HTMLElement);
  for (const item of PLATFORM_LIVE_ITEMS) expect(platform.getByText(item.name)).toBeInTheDocument();

  const roadmap = within(container.querySelector('#roadmap') as HTMLElement);
  for (const item of ROADMAP_PREVIEW_ITEMS) expect(roadmap.getByText(item.name)).toBeInTheDocument();

  for (const tool of CHANNEL_TOOLS) {
    const status = getImplementation(tool.registryId)?.status;
    const card = screen.getByRole('heading', { name: tool.title }).closest('article') as HTMLElement;
    expect(card.querySelector('.lv7-st')).toHaveClass(`lv7-st-${status}`);
  }
});

it('switches Titan/Nacht and shares the choice with the other landings', () => {
  mount();
  expect(document.querySelector('.lv7')).toHaveAttribute('data-theme', 'titan');
  fireEvent.click(screen.getByRole('button', { name: 'NACHT' }));
  expect(document.querySelector('.lv7')).toHaveAttribute('data-theme', 'nacht');
  expect(localStorage.getItem('rsd-landing-mode')).toBe('cyan');
  expect(screen.getByRole('button', { name: 'NACHT' })).toHaveAttribute('aria-pressed', 'true');
});

it('honours ?theme=nacht for preview links', () => {
  mount('/design/landing-v7?theme=nacht');
  expect(document.querySelector('.lv7')).toHaveAttribute('data-theme', 'nacht');
});

it('loads no external fonts and links only internal routes', () => {
  const css = readFileSync(resolve(__dirname, '../../src/styles/landing-v7.css'), 'utf8');
  expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  const { container } = mount();
  for (const a of Array.from(container.querySelectorAll('a[href]'))) {
    expect(a.getAttribute('href')).toMatch(/^[/#]/);
  }
});
