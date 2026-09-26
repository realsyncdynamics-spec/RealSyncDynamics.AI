/**
 * Startseite `/` — Hero-Vertrag Governance OS Handoff v2, Positionierung
 * 2026-09-26 (Erst-CTA → Governance-Check auf der Seite).
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignGovernanceAiLanding } from '../../src/pages/design/DesignGovernanceAiLanding';
import { resetLangForTests } from '../../src/i18n/useLang';

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); resetLangForTests(); });
const mount = () => render(<MemoryRouter initialEntries={['/']}><DesignGovernanceAiLanding /></MemoryRouter>);

it('renders the hero: problem hook, H1, loop and the two CTAs', () => {
  const view = mount();
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('Das Kontrollsystem für');
  expect(h1.querySelector('.rs-hero__h1-accent')).toHaveTextContent('Unternehmens-KI.');
  expect(screen.getByText('Wer kontrolliert eigentlich, was sie dürfen?')).toBeInTheDocument();
  // Kein Normen-Badge und keine Konformitätszusage im Hero.
  expect(screen.queryByText('EU AI Act · DSGVO · ISO 42001')).toBeNull();
  for (const word of ['DISCOVER', 'ASSESS', 'GOVERN', 'PROVE']) {
    expect(screen.getAllByText(word).length).toBeGreaterThan(0);
  }

  const check = view.container.querySelectorAll('[data-hero-cta="check"]');
  expect(check).toHaveLength(1);
  expect(check[0]).toHaveAttribute('href', '#governance-check');
  expect(check[0]).toHaveTextContent('KI-Governance prüfen');
  // Das Ziel des Erst-CTAs existiert auf der Seite.
  expect(view.container.querySelector('#governance-check')).not.toBeNull();

  const explore = screen.getByTestId('hero-secondary-cta');
  expect(explore).toHaveAttribute('href', '#governance-model');
  expect(explore).toHaveTextContent('Plattform entdecken');
  expect(view.container.querySelector('#governance-model')).not.toBeNull();
});

it('keeps every in-page anchor of the navigation resolvable', () => {
  const view = mount();
  const anchors = Array.from(view.container.querySelectorAll('a[href^="/#"], a[href^="#"]'));
  expect(anchors.length).toBeGreaterThan(0);
  for (const a of anchors) {
    const id = a.getAttribute('href')!.replace(/^\/?#/, '');
    expect(view.container.querySelector(`#${id}`), id).not.toBeNull();
  }
});

it('self-check result counts only the given answers and links to real routes', () => {
  const view = mount();
  const check = view.container.querySelector('#governance-check') as HTMLElement;
  const section = within(check);
  expect(section.getByText(/Beantworten Sie die Fragen/)).toBeInTheDocument();
  fireEvent.click(section.getAllByLabelText('Ja')[0]);
  fireEvent.click(section.getAllByLabelText('Nein')[1]);
  expect(section.getByText('1 von 8 Kontrollen vorhanden')).toBeInTheDocument();
  expect(section.getByText(/2 von 8 beantwortet · 1 offen oder unklar/)).toBeInTheDocument();
  expect(section.getByRole('link', { name: /Governance-Scan starten/ })).toHaveAttribute('href', '/audit');
  expect(section.getByRole('link', { name: 'Beratung anfragen' })).toHaveAttribute('href', '/contact-sales');
});

it('uses the Europe map v2 with WebP + PNG sources and no colour-mode switch', () => {
  const view = mount();
  const map = screen.getByTestId('hero-map');
  expect(map.querySelectorAll('source[type="image/webp"][srcset="/europe-map-v2.webp"]').length).toBeGreaterThan(0);
  expect(map.querySelectorAll('img[src="/europe-map-v2.png"]').length).toBe(2);
  expect(view.container.querySelector('[data-landing-mode]')).toBeNull();
  expect(screen.queryByRole('radiogroup')).toBeNull();
  expect(screen.queryByText('DUNKEL')).toBeNull();
});

it('switches DE → EN and persists the language', () => {
  const view = mount();
  fireEvent.click(screen.getAllByTestId('lang-toggle')[0]);
  expect(localStorage.getItem('rsd-lang')).toBe('en');
  expect(screen.getByText('Check your AI governance', { selector: '#check-cta' })).toBeInTheDocument();
  expect(screen.getByTestId('hero-secondary-cta')).toHaveTextContent('Explore the platform');
  view.unmount();
  mount();
  expect(screen.getAllByTestId('lang-toggle')[0]).toHaveAttribute('data-lang', 'en');
});

it('opens the mobile menu with all screens and closes on Escape', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }));
  const dialog = screen.getByRole('dialog');
  const menu = within(dialog);
  expect(menu.getByRole('link', { name: 'Preise' })).toHaveAttribute('href', '/#pricing');
  expect(menu.getByRole('link', { name: 'Governance' })).toHaveAttribute('href', '/governance-runtime');
  expect(menu.getByRole('link', { name: /KI-Governance prüfen/ })).toHaveAttribute('href', '#governance-check');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
