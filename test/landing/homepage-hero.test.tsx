/**
 * Startseite `/` — Hero-Vertrag Governance OS Handoff v2.
 * Ersetzt den früheren Modus-Umschalter-Test (Dunkel/Cyan/Hell ist auf `/` entfallen).
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignGovernanceAiLanding } from '../../src/pages/design/DesignGovernanceAiLanding';
import { HERO_DASHBOARD_CTA_LABEL } from '../../src/components/governance-frontend/hero-content';
import { resetLangForTests } from '../../src/i18n/useLang';

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); resetLangForTests(); });
const mount = () => render(<MemoryRouter initialEntries={['/']}><DesignGovernanceAiLanding /></MemoryRouter>);

it('renders the handoff hero: H1, badge, loop and the two CTAs', () => {
  const view = mount();
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('AI Governance');
  expect(h1).toHaveTextContent('Operations OS for Europe');
  expect(h1.querySelector('.rs-hero__h1-accent')).toHaveTextContent('for Europe');
  expect(screen.getByText('EU AI Act · DSGVO · ISO 42001')).toBeInTheDocument();
  for (const word of ['DISCOVER', 'ASSESS', 'GOVERN', 'PROVE']) {
    expect(screen.getByText(word)).toBeInTheDocument();
  }

  const audit = view.container.querySelectorAll('[data-hero-cta="audit"]');
  expect(audit).toHaveLength(1);
  expect(audit[0]).toHaveAttribute('id', 'audit-cta');
  expect(audit[0]).toHaveAttribute('href', '/audit');
  expect(audit[0]).toHaveTextContent('Governance-Scan starten');

  const dashboard = screen.getByTestId('hero-secondary-cta');
  expect(dashboard).toHaveAttribute('href', '/preview');
  expect(dashboard).toHaveTextContent(HERO_DASHBOARD_CTA_LABEL);
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
  expect(screen.getByText('Start governance scan', { selector: '#audit-cta' })).toBeInTheDocument();
  expect(screen.getByTestId('hero-secondary-cta')).toHaveTextContent('View live dashboard');
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
  expect(menu.getByRole('link', { name: 'Evidence' })).toHaveAttribute('href', '/#audit-trail');
  expect(menu.getByRole('link', { name: 'Governance' })).toHaveAttribute('href', '/governance-runtime');
  expect(menu.getByRole('link', { name: /Governance-Scan starten/ })).toHaveAttribute('href', '/audit');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
