/**
 * Startseite `/` — Europe reference hero and existing entry contracts.
 * Prüft den zweifarbigen Hell/Dunkel-Umschalter auf der aktuellen Referenzseite.
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

it('renders the reference copy, loop and the existing audit/dashboard entry points', () => {
  const view = mount();
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('AI Compliance');
  expect(h1).toHaveTextContent('Operations OS for Europe');
  expect(h1.querySelector('.rs-hero__h1-accent')).toHaveTextContent('for Europe');
  expect(screen.getByText('Runtime governance for regulated AI systems.')).toBeInTheDocument();
  expect(screen.getByText('Continuous evidence. EU-native by design.')).toBeInTheDocument();
  for (const word of ['DISCOVER', 'CLASSIFY', 'ENFORCE', 'PROVE']) {
    expect(screen.getByText(word)).toBeInTheDocument();
  }

  const audit = view.container.querySelectorAll('[data-hero-cta="audit"]');
  expect(audit).toHaveLength(1);
  expect(audit[0]).toHaveAttribute('id', 'audit-cta');
  expect(audit[0]).toHaveAttribute('href', '/audit');
  expect(audit[0]).toHaveTextContent('Free Audit starten');

  const dashboard = screen.getByTestId('hero-secondary-cta');
  expect(dashboard).toHaveAttribute('href', '/app/dashboard');
  expect(dashboard).toHaveTextContent(HERO_DASHBOARD_CTA_LABEL);
});

it('loads one prioritized reference image and exposes the Hell/Dunkel color switch', () => {
  const view = mount();
  const map = screen.getByTestId('hero-map');
  expect(map.querySelector('source[type="image/webp"]')).toHaveAttribute('srcset', '/europe-reference-hero.webp');
  expect(map.querySelectorAll('img')).toHaveLength(1);
  expect(map.querySelector('img')).toHaveAttribute('src', '/europe-reference-hero.jpg');
  expect(map.querySelector('img')).toHaveAttribute('fetchpriority', 'high');
  expect(view.container.querySelector('[data-landing-mode]')).toHaveAttribute('data-landing-mode', 'cyan');
  expect(screen.getByRole('radiogroup', { name: 'Farbmodus' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'DUNKEL' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('radio', { name: 'HELL' }));
  expect(screen.getByRole('radio', { name: 'HELL' })).toHaveAttribute('aria-checked', 'true');
  expect(view.container.querySelector('[data-landing-mode]')).toHaveAttribute('data-landing-mode', 'light');
});

it('switches DE → EN and persists the language', () => {
  const view = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }));
  fireEvent.click(screen.getAllByTestId('lang-toggle')[0]);
  expect(localStorage.getItem('rsd-lang')).toBe('en');
  expect(screen.getByText('Start free audit', { selector: '#audit-cta' })).toBeInTheDocument();
  expect(screen.getByTestId('hero-secondary-cta')).toHaveTextContent('View live dashboard');
  view.unmount();
  mount();
  expect(screen.getByTestId('hero-secondary-cta')).toHaveTextContent('View live dashboard');
});

it('opens the public navigation and restores focus and scrolling after Escape', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }));
  const dialog = screen.getByRole('dialog');
  const menu = within(dialog);
  expect(menu.getByRole('link', { name: 'Preise' })).toHaveAttribute('href', '/pricing');
  expect(menu.getByRole('link', { name: 'Produkt' })).toHaveAttribute('href', '#modules');
  expect(menu.getByRole('link', { name: 'Evidence' })).toHaveAttribute('href', '/evidence');
  expect(menu.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  expect(menu.getByRole('link', { name: /Free Audit starten/ })).toHaveAttribute('href', '/audit');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Navigation öffnen' })).toHaveFocus();
  expect(document.body.style.overflow).not.toBe('hidden');
});
