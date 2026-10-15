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
  expect(beta).toHaveTextContent(`Offene Beta: alle Funktionen kostenlos testen bis ${BETA.endsLabel}`);
  const href = beta?.getAttribute('href') ?? '';
  expect(href.startsWith('/welcome?')).toBe(true);
  expect(new URLSearchParams(href.split('?')[1]).get('source')).toBe('landing-v6-hero');
});

it('routes the self-check into the domain scan with its own source', () => {
  const view = mount();
  const check = within(view.container.querySelector('#check') as HTMLElement);
  expect(check.getByText(/den kostenlosen Website-Check starten/)).toBeInTheDocument();
  fireEvent.click(check.getAllByRole('radio')[0]);
  expect(check.getByText(/Ihre Einschätzung mit einem Scan Ihrer Domain belegen/)).toBeInTheDocument();
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
