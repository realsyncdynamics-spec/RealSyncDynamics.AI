import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DesignGovernanceAiLanding } from '../../src/pages/design/DesignGovernanceAiLanding';

// WebGL is independent of the production page's mode integration.
vi.mock('../../src/components/landing/EuropeNetworkHero', () => ({ EuropeNetworkHero: () => null }));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const mount = () => render(<MemoryRouter initialEntries={['/']}><DesignGovernanceAiLanding /></MemoryRouter>);

it('changes and persists all three modes on the actual production landing, keeping its content', () => {
  const view = mount();
  const headline = screen.getByRole('heading', { level: 1 }).textContent;
  for (const [label, value] of [['HELL', 'light'], ['CYAN', 'cyan'], ['DUNKEL', 'gold']]) {
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect(view.container.querySelector('[data-landing-mode]')).toHaveAttribute('data-landing-mode', value);
    expect(localStorage.getItem('rsd-landing-mode')).toBe(value);
    expect(screen.getByRole('radio', { name: label })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(headline);
  }
  fireEvent.click(screen.getByRole('radio', { name: 'CYAN' }));
  view.unmount();
  mount();
  expect(screen.getByRole('radio', { name: 'CYAN' })).toHaveAttribute('aria-checked', 'true');
});

it('offers the same keyboard-operable modes in the expanded mobile navigation', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Navigation öffnen' }));
  const groups = screen.getAllByRole('radiogroup', { name: 'Farbmodus der Startseite' });
  const mobile = within(groups[1]);
  fireEvent.keyDown(mobile.getByRole('radio', { name: 'DUNKEL' }), { key: 'End' });
  expect(mobile.getByRole('radio', { name: 'HELL' })).toHaveAttribute('aria-checked', 'true');
  expect(mobile.getByRole('radio', { name: 'HELL' })).toHaveFocus();
  expect(localStorage.getItem('rsd-landing-mode')).toBe('light');
});
