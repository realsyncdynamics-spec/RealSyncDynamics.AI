/**
 * Startseite `/` (Landing v6): Produkte einzeln erreichbar. Jede Karte führt
 * auf ihre Produktseite und trägt den Status aus der Registry.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6View } from '../../src/components/landing/v6/LandingV6View';
import { useLandingV6 } from '../../src/components/landing/v6/useLandingV6';
import {
  PRODUCT_CATALOG,
  productStatus,
  productStatusLabel,
} from '../../src/product/product-catalog';

function Harness() {
  return <LandingV6View v={useLandingV6()} />;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const mount = () => render(<MemoryRouter initialEntries={['/']}><Harness /></MemoryRouter>);

it('zeigt jedes Katalogprodukt als eigene Karte mit Link auf die Produktseite', () => {
  mount();
  const section = screen.getByTestId('landing-products');
  const cards = within(section).getAllByRole('link');
  expect(cards).toHaveLength(PRODUCT_CATALOG.length);
  PRODUCT_CATALOG.forEach((p, i) => {
    const card = screen.getByTestId(`product-card-${p.id}`);
    expect(cards[i]).toBe(card);
    expect(card).toHaveAttribute('href', p.landingPath);
    expect(card).toHaveTextContent(p.name);
  });
});

it('übernimmt den Status jedes Produkts aus der Registry', () => {
  const view = mount();
  for (const p of PRODUCT_CATALOG) {
    expect(screen.getByTestId(`product-status-${p.id}`)).toHaveTextContent(productStatusLabel(p));
    const li = view.container.querySelector(`[data-product-id="${p.id}"]`);
    expect(li).toHaveAttribute('data-product-status', productStatus(p));
  }
});

it('steht vor den Governance-Abschnitten und ist aus der Footer-Navigation erreichbar', () => {
  const view = mount();
  const ids = Array.from(view.container.querySelectorAll('main section[id]')).map((s) => s.id);
  expect(ids.indexOf('produkte')).toBeGreaterThanOrEqual(0);
  expect(ids.indexOf('produkte')).toBeLessThan(ids.indexOf('produkt'));
  expect(within(screen.getByRole('navigation', { name: 'Produkt' })).getByRole('link', { name: 'Produkte' }))
    .toHaveAttribute('href', '#produkte');
});
