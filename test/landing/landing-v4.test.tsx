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
  const secondary = view.container.querySelector('.hero .btn-ghost');
  expect(secondary).toHaveAttribute('href', '/governance-runtime');
  expect(secondary?.textContent).toMatch(/Runtime ansehen/);
  expect(secondary?.textContent).not.toMatch(/Live|Demo/i);
  expect(view.container.querySelector('header .cta-pill')).toHaveAttribute('href', '/audit');
  // LIVE_CAPS: Klassifizierung claims public classifier only (no inventory persist).
  const classify = Array.from(view.container.querySelectorAll('#platform .card')).find((c) =>
    c.querySelector('h3')?.textContent?.includes('EU-AI-Act-Klassifizierung'),
  );
  expect(classify).toBeTruthy();
  expect(classify).toHaveAttribute('href', '/ai-act-klassifikator');
  expect(classify?.textContent).not.toMatch(/als Inventar führen/i);
  expect(classify?.textContent).toMatch(/Klassifikator|Risikoklasse/i);
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

it('roadmap comes from the registry and omits redirect-only design landings', () => {
  const view = mount();
  const roadmap = view.container.querySelector('#roadmap')!;
  expect(roadmap.textContent).toContain('Product-Registry');
  expect(roadmap.textContent).toContain('Compliance Command Center');
  expect(roadmap.textContent).toContain('CommandCenterDashboard');
  expect(roadmap.textContent).toContain('/ai-act-klassifikator');
  expect(roadmap.textContent).toContain('EU-AI-Act-Inventar (Persistenz)');
  expect(roadmap.textContent).toMatch(/kein Upgrade|keinem Plan/i);
  expect(roadmap.textContent).not.toContain('produktionsreifer E2E-Pfad offen');
  expect(roadmap.textContent).not.toContain('sind aber nicht der Live-Hero');
  expect(roadmap.textContent).not.toContain('/ai-act-governance');
  expect(roadmap.textContent).not.toContain('als Inventar führen');
  expect(roadmap.textContent).not.toContain('/design/ledger');
  expect(roadmap.textContent).not.toContain('/design/tribunal');
  expect(roadmap.textContent).not.toContain('Evidence Ledger Landing (Design)');
  expect(roadmap.textContent).not.toContain('Tribunal Landing (Design)');
  // Agent OS preview cards must not advertise a live /app/dashboard mount.
  const previewCards = Array.from(roadmap.querySelectorAll('.rm-card.dashed h4'))
    .filter((h) => h.textContent?.includes('Agent OS') || h.textContent?.includes('Agent OS™') || h.textContent?.includes('RealSync Agent OS'));
  for (const h of previewCards) {
    const card = h.closest('.rm-card');
    expect(card?.querySelector('u')?.textContent ?? '').not.toBe('/app/dashboard');
  }
});

it('sends the scan form into /audit with the URL', () => {
  mount();
  fireEvent.change(screen.getByLabelText('Website-URL für Governance-Scan'), { target: { value: 'https://example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /Audit starten/ }));
  expect(screen.getByTestId('where')).toHaveTextContent('/audit?url=https%3A%2F%2Fexample.com');
});
