/**
 * Startseite `/` (Landing v6) — Trichter-Vertrag: Beta-Hinweis unter dem
 * Hero-CTA, Check → Scan mit eigener Quelle, Beweis-Abschnitte vor Agenten.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6View } from '../../src/components/landing/v6/LandingV6View';
import { useLandingV6 } from '../../src/components/landing/v6/useLandingV6';
import { BETA } from '../../src/config/beta';
import { CTA } from '../../src/content/runtimeVocab';

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

it('keeps the free scan as primary hero CTA and adds the beta offer below it', () => {
  mount();
  expect(screen.getByTestId('hero-primary-cta')).toHaveAttribute('href', '/audit?source=landing-v6');
  const beta = screen.queryByTestId('hero-beta-link');
  if (!(BETA.active && BETA.publicOffer)) {
    expect(beta).toBeNull();
    return;
  }
  expect(beta).toHaveTextContent(`Offene Beta: kostenlos testen bis ${BETA.endsLabel} · keine Kreditkarte`);
  // Claims-Grenze aus config/beta.ts: bis WP-3 nur „kostenlos testen“ versprechen.
  expect(beta).not.toHaveTextContent(/alle Funktionen/);
  const href = beta?.getAttribute('href') ?? '';
  expect(href.startsWith('/welcome?')).toBe(true);
  expect(new URLSearchParams(href.split('?')[1]).get('source')).toBe('landing-v6-hero');
});

it('routes the self-check into the domain scan with its own source', () => {
  const view = mount();
  const check = within(view.container.querySelector('#check') as HTMLElement);
  expect(check.getByText(/den kostenlosen Website-Check starten/)).toBeInTheDocument();
  fireEvent.click(check.getAllByRole('radio')[0]);
  expect(check.getByText(/Ihre Einschätzung mit dem kostenlosen Website-Check Ihrer Domain belegen/)).toBeInTheDocument();
  expect(check.getByTestId('check-audit-cta')).toHaveAttribute('href', '/audit?source=landing-v6-check');
});

it('shows proof (Control Room, Evidence) before Agent Governance', () => {
  const view = mount();
  const ids = Array.from(view.container.querySelectorAll('section[id]')).map((s) => s.id);
  expect(ids.indexOf('produkt')).toBeLessThan(ids.indexOf('control-room'));
  expect(ids.indexOf('control-room')).toBeLessThan(ids.indexOf('evidence'));
  expect(ids.indexOf('evidence')).toBeLessThan(ids.indexOf('agenten'));
  expect(ids.indexOf('agenten')).toBeLessThan(ids.indexOf('check'));
});

it('offers both website paths: automatic SiteOS draft and individual web design', () => {
  const view = mount();
  const ids = Array.from(view.container.querySelectorAll('section[id]')).map((s) => s.id);
  expect(ids.indexOf('websites')).toBeGreaterThan(-1);
  expect(ids.indexOf('websites')).toBeLessThan(ids.indexOf('preise'));
  const sec = within(screen.getByTestId('landing-websites'));
  expect(view.container.querySelector('[data-website-cta="auto"]')).toHaveAttribute('href', '/build');
  expect(view.container.querySelector('[data-website-cta="custom"]')).toHaveAttribute(
    'href',
    '/contact-sales?intent=webdesign&source=landing-v6-websites',
  );
  // Ehrlicher Status: Builder/Veröffentlichung sind Preview, nur Weg 1 trägt das Badge.
  expect(sec.getAllByText('PREVIEW')).toHaveLength(1);
  expect(sec.getByRole('link', { name: 'Leistungsumfang ansehen' })).toHaveAttribute('href', '/frontend-builder');
  // Haupt-CTA der Dienstleistung ist die kanonische Ausnahme aus runtimeVocab.
  expect(view.container.querySelector('[data-website-cta="custom"]')).toHaveTextContent(CTA.webdesign);
  expect(sec.queryByText(/Projekt mit Dominik besprechen/)).toBeNull();
  // Erweiterung: individuelle Dashboards, Bots/Workflows nur „soweit verfügbar“.
  const ext = within(screen.getByTestId('landing-websites-extension'));
  for (const branche of ['Handwerk', 'Arztpraxis', 'Kanzlei']) expect(ext.getByText(branche)).toBeInTheDocument();
  expect(ext.getByText(/Bots .*KI-Workflows und Integrationen/)).toBeInTheDocument();
  expect(ext.getByText(/tatsächlich verfügbar/)).toBeInTheDocument();
  // Hauptnavigation erst ab 1180 px (jsdom: 1024) — Footer-Navigation rendert immer.
  expect(within(screen.getByRole('navigation', { name: 'Produkt' })).getByRole('link', { name: 'Websites' }))
    .toHaveAttribute('href', '#websites');
});

it('shows regular SaaS prices with the 14-day trial instead of a blanket free beta', () => {
  const view = mount();
  const pricing = view.container.querySelector('#preise') as HTMLElement;
  // Entscheidung 18.10.2026: kein Pauschalversprechen „kostenlos bis …“ mehr.
  expect(BETA.publicOffer).toBe(false);
  expect(pricing).not.toHaveTextContent(`kostenlos bis ${BETA.endsLabel}`);
  expect(pricing).not.toHaveTextContent(/Offene Beta/);
  expect(pricing).toHaveTextContent('79 €');
  expect(pricing).toHaveTextContent('249 €');
  expect(pricing).toHaveTextContent('699 €');
  expect(pricing).toHaveTextContent('Starter und Growth können Sie 14 Tage kostenlos testen.');
  const starter = view.container.querySelector('[data-plan-cta="starter"]');
  expect(starter).toHaveTextContent('14 Tage kostenlos testen');
  expect(starter?.getAttribute('href')?.startsWith('/checkout/')).toBe(true);
  expect(view.container.querySelector('[data-plan-cta="agency"]')?.getAttribute('href')?.startsWith('/checkout/')).toBe(true);
});
