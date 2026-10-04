/**
 * Landing v4 „Klassisch" (`/`) — Vertrag: H1, Betriebsschleife, CTAs in echte
 * Routen, auflösbare In-Page-Anker, Roadmap-Filter, Scan-Formular.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LandingV4 } from '../../src/pages/LandingV4';

// Die 3D-Szene braucht WebGL; im DOM-Test genügt, dass sie nicht mountet.
vi.mock('../../src/components/landing/v4/heroEarthScene', () => ({ mountHeroEarth: () => () => {} }));

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingV4 />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

it('renders the v4 hero: H1, loop and CTAs into real routes', () => {
  const view = mount();
  // Zeilenumbruch per <br> wie in der Referenz; der zugängliche Name trennt die Zeilen.
  screen.getByRole('heading', { level: 1, name: /AI Compliance\s*Operations OS for Europe/ });
  expect(view.container.querySelectorAll('h1')).toHaveLength(1);
  expect(view.container.querySelector('.loop')?.textContent).toBe('DiscoverClassifyEnforceProve');
  expect(view.container.querySelector('#scan')).toHaveAttribute('href', '/audit');
  expect(view.container.querySelector('.hero .btn-ghost')).toHaveAttribute('href', '/demo-tour/dashboard');
  expect(view.container.querySelector('header .cta-pill')).toHaveAttribute('href', '/audit');
});

it('keeps every in-page anchor resolvable and every route link relative', () => {
  const view = mount();
  for (const a of Array.from(view.container.querySelectorAll('a'))) {
    const href = a.getAttribute('href')!;
    expect(href, a.textContent ?? '').toMatch(/^[#/]/);
    if (href.startsWith('#') && href !== '#top') {
      expect(view.container.querySelector(href), href).not.toBeNull();
    }
  }
});

it('filters roadmap groups by status', () => {
  const view = mount();
  const groups = () =>
    Array.from(view.container.querySelectorAll<HTMLElement>('#roadmap .group-head'))
      .filter((h) => (h.parentElement as HTMLElement).style.display !== 'none')
      .map((h) => h.querySelector('h3')?.textContent);
  expect(groups()).toEqual(['LIVE', 'IN PREVIEW', 'NEXT']);
  fireEvent.click(screen.getByRole('button', { name: 'IN PREVIEW' }));
  expect(groups()).toEqual(['IN PREVIEW']);
  expect(screen.getByRole('button', { name: 'IN PREVIEW' })).toHaveAttribute('aria-pressed', 'true');
});

it('sends the scan form into /audit with the URL', () => {
  mount();
  fireEvent.change(screen.getByLabelText('Website-URL für Governance-Scan'), { target: { value: 'https://example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /Audit starten/ }));
  expect(screen.getByTestId('where')).toHaveTextContent('/audit?url=https%3A%2F%2Fexample.com');
});
