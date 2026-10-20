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

it('keeps one filled CTA in the hero and ties the plan row to it with its own source', () => {
  mount();
  const plans = within(screen.getByRole('group', { name: 'Pläne und Preise' }));
  const links = plans.getAllByRole('link').filter((a) => a.hasAttribute('data-hero-cta') && a.getAttribute('data-hero-cta')!.startsWith('plan-'));
  expect(links.length).toBeGreaterThan(0);
  for (const a of links) {
    const href = a.getAttribute('href') ?? '';
    expect(new URLSearchParams(href.split('?')[1]).get('source')).toBe('landing-v6-hero');
  }
  // Enterprise bleibt erreichbar, jetzt als Teil der Preiszeile statt als zweiter Hero-Button.
  const enterprise = screen.getByTestId('hero-secondary-cta');
  expect(enterprise).toHaveAttribute('href', '/contact-sales?tier=enterprise&source=landing-v6');
  expect(enterprise).toHaveTextContent('Auf Anfrage');
  expect(plans.getByRole('link', { name: 'Leistungen vergleichen' })).toHaveAttribute('href', '#preise');
});
