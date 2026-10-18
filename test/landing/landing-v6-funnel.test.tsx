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
  if (!BETA.active) {
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

it('offers both website paths: automatic SiteOS draft and personal design with Dominik', () => {
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
  // Hauptnavigation erst ab 1180 px (jsdom: 1024) — Footer-Navigation rendert immer.
  expect(within(screen.getByRole('navigation', { name: 'Produkt' })).getByRole('link', { name: 'Websites' }))
    .toHaveAttribute('href', '#websites');
});
