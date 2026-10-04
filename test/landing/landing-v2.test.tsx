/**
 * Landing v2 (`/design/landing-v2`) — Vertrag des Claude-Design-Handoffs:
 * H1, Pipeline, Tier-Buttons aus der Pricing-SSoT, Sektionsreihenfolge,
 * Bruttopreise inkl. gesetzlicher USt (Regelbesteuerung), Hell/Dunkel-Umschaltung.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV2 } from '../../src/pages/LandingV2';
import { LV2_FAQ, lv2FaqJsonLd } from '../../src/components/landing/v2/landing-v2-content';
import { checkoutHrefForPlan, formatPriceEur, planById, PRICING_TAX_NOTE_STANDARD } from '../../shared/pricing';

/** Intl setzt ein geschütztes Leerzeichen vor „€“ — für Textvergleiche normalisieren. */
const eur = (v: number) => formatPriceEur(v).replace(/\u00a0/g, ' ');
const text = (el: Element | null) => (el?.textContent ?? '').replace(/\u00a0/g, ' ');

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/design/landing-v2']}>
      <LandingV2 />
    </MemoryRouter>,
  );

it('renders hero H1, pipeline and tier buttons from the pricing SSoT', () => {
  const view = mount();
  const h1 = screen.getByRole('heading', { level: 1 });
  expect((h1.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(
    'AI Compliance Operations OS for Europe',
  );
  expect(view.container.querySelectorAll('h1')).toHaveLength(1);

  const pipeline = screen.getByRole('list', { name: 'Betriebsschleife' });
  for (const step of ['Discover', 'Assess', 'Govern', 'Execute', 'Verify', 'Prove']) {
    expect(within(pipeline).getByText(step)).toBeInTheDocument();
  }

  const primary = screen.getByTestId('hero-primary-cta');
  expect(primary).toHaveAttribute('href', checkoutHrefForPlan('free', { source: 'landing-v2-hero' }));

  for (const id of ['starter', 'growth', 'agency'] as const) {
    const plan = planById(id);
    const btn = view.container.querySelector(`[data-hero-cta="plan-${id}"]`);
    expect(btn, id).not.toBeNull();
    expect(btn).toHaveAttribute('href', checkoutHrefForPlan(plan, { source: 'landing-v2-hero' }));
    expect(text(btn)).toContain(eur(plan.price.monthlyEur));
  }
  expect(screen.getByTestId('hero-secondary-cta')).toHaveAttribute(
    'href',
    '/contact-sales?tier=enterprise&source=landing-v2-hero',
  );
});

it('keeps the handoff section order and resolvable in-page anchors', () => {
  const view = mount();
  const ids = Array.from(view.container.querySelectorAll('main section[id]')).map((s) => s.id);
  expect(ids).toEqual([
    'top',
    'regulierung',
    'produkt',
    'control-room',
    'evidence',
    'architektur',
    'architecture',
    'governance-check',
    'preise',
    'faq',
  ]);

  for (const a of Array.from(view.container.querySelectorAll('a[href^="#"]'))) {
    const id = a.getAttribute('href')!.slice(1);
    expect(view.container.querySelector(`#${id}`), id).not.toBeNull();
  }
});

it('shows four plan cards with SSoT prices and the gross-price VAT note', () => {
  const view = mount();
  const cards = view.container.querySelectorAll('.lv2-plan');
  expect(cards).toHaveLength(4);
  expect(within(cards[0] as HTMLElement).getByText(eur(79))).toBeInTheDocument();
  expect(within(cards[1] as HTMLElement).getByText(eur(249))).toBeInTheDocument();
  expect(within(cards[2] as HTMLElement).getByText(eur(699))).toBeInTheDocument();
  expect(within(cards[3] as HTMLElement).getByText('Auf Anfrage')).toBeInTheDocument();
  expect(cards[1]).toHaveAttribute('data-featured', 'true');

  expect(view.container.querySelector('[data-plan-cta="growth"]')).toHaveAttribute(
    'href',
    checkoutHrefForPlan('growth', { source: 'landing-v2-pricing' }),
  );

  const foot = view.container.querySelector('.lv2-pricing__foot')!;
  expect(foot.textContent).toContain(PRICING_TAX_NOTE_STANDARD);
  expect(view.container.textContent).not.toMatch(/§\s*19\s*UStG|Kleinunternehmer/);
  expect(view.container.textContent).not.toMatch(/zzgl\. (gesetzlicher )?USt/i);
  expect(view.container.textContent).not.toMatch(/GmbH|HRB/);

  // Jahres-Toggle zeigt keinen unbuchbaren Jahresbetrag (check:offer-prices).
  fireEvent.click(screen.getByRole('button', { name: /Jährlich/ }));
  expect(text(view.container)).not.toContain(eur(790));
  expect(within(cards[0] as HTMLElement).getByText(/in Vorbereitung/)).toBeInTheDocument();
});

it('switches theme and persists it in the shared landing-mode storage', () => {
  const view = mount();
  const root = view.container.querySelector('.lv2')!;
  expect(root).toHaveAttribute('data-lv2-theme', 'dark');
  fireEvent.click(screen.getAllByRole('button', { name: 'Hell' })[0]);
  expect(root).toHaveAttribute('data-lv2-theme', 'light');
  expect(localStorage.getItem('rsd-landing-mode')).toBe('light');
});

it('renders the FAQ from the same source as the FAQPage JSON-LD', () => {
  mount();
  for (const f of LV2_FAQ) expect(screen.getByText(f.q)).toBeInTheDocument();
  const ld = lv2FaqJsonLd() as { mainEntity: unknown[] };
  expect(ld.mainEntity).toHaveLength(LV2_FAQ.length);
});
