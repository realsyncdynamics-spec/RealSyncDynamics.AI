/**
 * Landing v4 (`/`) — Vertrag: H1, Betriebsschleife, CTAs in echte Routen,
 * auflösbare In-Page-Anker, Mobile-Menü.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV4 } from '../../src/pages/LandingV4';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <LandingV4 />
    </MemoryRouter>,
  );

it('renders the v4 hero: H1, four-step loop and CTAs into real routes', () => {
  const view = mount();
  const h1 = screen.getByRole('heading', { level: 1 });
  expect((h1.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('AI Compliance Operations OS for Europe');
  expect(view.container.querySelectorAll('h1')).toHaveLength(1);

  const loop = screen.getByRole('list', { name: 'Betriebsschleife' });
  expect(within(loop).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Discover',
    'Classify',
    'Enforce',
    'Prove',
  ]);

  expect(screen.getByTestId('hero-primary-cta')).toHaveAttribute('href', '/audit?source=landing-v4-hero');
  expect(screen.getByTestId('hero-secondary-cta')).toHaveAttribute('href', '/demo-tour/dashboard');
});

it('keeps every in-page anchor resolvable', () => {
  const view = mount();
  const anchors = Array.from(view.container.querySelectorAll('a[href^="#"]'));
  expect(anchors.length).toBeGreaterThan(0);
  for (const a of anchors) {
    const id = a.getAttribute('href')!.slice(1);
    expect(view.container.querySelector(`#${id}`), id).not.toBeNull();
  }
});

it('opens the mobile menu with focus inside and restores focus on Escape', () => {
  mount();
  const trigger = screen.getByRole('button', { name: 'Menü öffnen' });
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');
  expect(dialog.contains(document.activeElement)).toBe(true);
  const menu = within(dialog);
  expect(menu.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/welcome');
  expect(menu.getByRole('link', { name: 'Free Audit starten' })).toHaveAttribute('href', '/audit?source=landing-v4');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
