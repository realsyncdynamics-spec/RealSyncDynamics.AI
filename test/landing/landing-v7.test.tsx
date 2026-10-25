/**
 * Landing v7 (/design/landing-v7) — Design-Artefakt Titan/Nacht. Optik aus dem
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

it('is routed as design preview; / stays Landing v6', () => {
  const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
  expect(app).toMatch(/path="\/"\s+element=\{<LandingV6/);
  expect(app).toMatch(/path="\/design\/landing-v7" element=\{<LandingV7 \/>\}/);
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
      expect(card.querySelector('s')).toHaveTextContent(formatPriceEur(plan.price.monthlyEur));
      expect(within(card).getByRole('link').getAttribute('href')).toMatch(/^\/welcome\?/);
    } else {
      expect(amount).toContain(formatPriceEur(plan.price.monthlyEur));
    }
  }
});

it('never shows the internal Enterprise list price and keeps TISAX/DORA coming soon', () => {
  const { container } = mount();
  expect(container.textContent).not.toContain('1.249');
  expect(container.textContent).toContain('Auf Anfrage');
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
