/**
 * Startseite `/` — Vertrag der Governance-OS-Positionierung: Hero, geführte
 * Demonstration, Signature Pipeline, Beispiel-Kennzeichnung, Governance-Check.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignGovernanceAiLanding } from '../../src/pages/design/DesignGovernanceAiLanding';
import { resetLangForTests } from '../../src/i18n/useLang';
import { DEMO_LABEL } from '../../src/components/governance-frontend/hero-content';

function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
  stubMotion(false);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); resetLangForTests(); });
const mount = () => render(<MemoryRouter initialEntries={['/']}><DesignGovernanceAiLanding /></MemoryRouter>);

it('renders the Governance OS hero: category eyebrow, H1, six-stage loop and CTAs', () => {
  const view = mount();
  expect(screen.getByText('REALSYNCDYNAMICS.AI / GOVERNANCE OS')).toBeInTheDocument();
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('Ihre KI kann handeln.');
  expect(h1.querySelector('.rs-hero__h1-accent')).toHaveTextContent('Governance.');
  // Regulierung ist nicht die Produktidentität: kein Normen-Badge im Hero.
  expect(screen.queryByText('EU AI Act · DSGVO · ISO 42001')).toBeNull();
  const loop = view.container.querySelector('.rs-loop') as HTMLElement;
  for (const word of ['DISCOVER', 'ASSESS', 'GOVERN', 'EXECUTE', 'VERIFY', 'PROVE']) {
    expect(within(loop).getByText(word)).toBeInTheDocument();
  }

  const primary = view.container.querySelectorAll('[data-hero-cta="pipeline"]');
  expect(primary).toHaveLength(1);
  expect(primary[0]).toHaveAttribute('href', '#pipeline');
  expect(primary[0]).toHaveTextContent('Governance OS erleben');

  const secondary = screen.getByTestId('hero-secondary-cta');
  expect(secondary).toHaveAttribute('href', '#architecture');
  expect(secondary).toHaveTextContent('Architektur ansehen');

  expect(screen.getByTestId('hero-enterprise-link')).toHaveAttribute(
    'href',
    '/contact-sales?tier=enterprise&source=home-hero',
  );
  expect(within(screen.getByTestId('hero-status')).getByText(/eu-central-1/i)).toBeInTheDocument();
});

it('keeps every in-page anchor resolvable', () => {
  const view = mount();
  const anchors = Array.from(view.container.querySelectorAll('a[href^="/#"], a[href^="#"]'));
  expect(anchors.length).toBeGreaterThan(0);
  for (const a of anchors) {
    const id = a.getAttribute('href')!.replace(/^\/?#/, '');
    expect(view.container.querySelector(`#${id}`), id).not.toBeNull();
  }
});

it('labels every surface with example values as demo data', () => {
  mount();
  for (const id of ['system-story-visual', 'pipeline-panel', 'control-room']) {
    expect(within(screen.getByTestId(id)).getByText(DEMO_LABEL)).toBeInTheDocument();
  }
});

it('pipeline pauses at approval until an approver releases it', () => {
  stubMotion(true);
  mount();
  const panel = screen.getByTestId('pipeline-panel');
  expect(within(screen.getByTestId('pipeline-stage-approval')).getByText('REQUIRED · WARTET')).toBeInTheDocument();
  expect(screen.getByTestId('pipeline-stage-execution')).toHaveAttribute('data-state', 'pending');

  fireEvent.click(within(panel).getByRole('button', { name: 'Als Approver freigeben' }));
  expect(within(screen.getByTestId('pipeline-stage-approval')).getByText('APPROVED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-execution')).getByText('RELEASED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-evidence')).getByText('RECORDED')).toBeInTheDocument();
});

it('pipeline closes the gate on a policy violation and still records evidence', () => {
  stubMotion(true);
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Policy-Verstoß' }));
  expect(within(screen.getByTestId('pipeline-stage-policy')).getByText('BLOCKED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-execution')).getByText('NOT EXECUTED')).toBeInTheDocument();
  expect(within(screen.getByTestId('pipeline-stage-evidence')).getByText('RECORDED')).toBeInTheDocument();
});

it('pipeline animates stage by stage without reduced motion', () => {
  vi.useFakeTimers();
  mount();
  expect(screen.getByTestId('pipeline-stage-request')).toHaveAttribute('data-state', 'current');
  act(() => { vi.advanceTimersByTime(480); });
  expect(screen.getByTestId('pipeline-stage-request')).toHaveAttribute('data-state', 'done');
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
  expect(section.getByRole('link', { name: 'Enterprise anfragen' })).toHaveAttribute('href', '/contact-sales?tier=enterprise&source=home-check');
});

it('shows Enterprise on request, without a public price', () => {
  const view = mount();
  const pricing = view.container.querySelector('#pricing') as HTMLElement;
  expect(within(pricing).getByText('ENTERPRISE')).toBeInTheDocument();
  expect(within(pricing).getByText('Auf Anfrage')).toBeInTheDocument();
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
  expect(screen.getByText('Experience the Governance OS', { selector: '#pipeline-cta' })).toBeInTheDocument();
  expect(screen.getByTestId('hero-secondary-cta')).toHaveTextContent('View the architecture');
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
  expect(menu.getByRole('link', { name: /Governance OS erleben/ })).toHaveAttribute('href', '#pipeline');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
