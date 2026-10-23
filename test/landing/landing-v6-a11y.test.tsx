/**
 * Landing v6 (`/`) — Barrierefreiheit der interaktiven Teile.
 *
 * Vertrag: Menü und KI-Act-Einordnung verhalten sich wie modale Dialoge
 * (Fokus hinein, Tab bleibt drin, Escape schließt, Fokus zurück zum Auslöser),
 * Auswahl-Buttons melden ihren Zustand, dekorative Icons werden nicht vorgelesen.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6 } from '../../src/pages/LandingV6';

const initialWidth = window.innerWidth;

const setWidth = (value: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setWidth(initialWidth);
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <LandingV6 />
    </MemoryRouter>,
  );

it('hides every decorative icon from assistive technology', () => {
  const { container } = mount();
  expect(container.querySelectorAll('svg:not([aria-hidden="true"])')).toHaveLength(0);
});

it('mobile menu: announces its state, takes focus and hands it back on Escape', () => {
  setWidth(800);
  mount();
  const burger = screen.getByRole('button', { name: 'Menü öffnen' });
  expect(burger).toHaveAttribute('aria-expanded', 'false');
  expect(burger).toHaveAttribute('aria-controls', 'lv6-menu');

  burger.focus();
  fireEvent.click(burger);
  expect(burger).toHaveAttribute('aria-expanded', 'true');
  const menu = screen.getByRole('dialog', { name: 'Menü' });
  expect(menu).toHaveAttribute('id', 'lv6-menu');
  expect(document.activeElement).toBe(within(menu).getByRole('button', { name: 'Menü schließen' }));

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Menü' })).toBeNull();
  expect(document.activeElement).toBe(burger);
});

it('classifier dialog: traps Tab, reports step and selection state', () => {
  mount();
  const opener = screen.getByRole('button', { name: /Eigene Risikoklasse in 3 Minuten prüfen/ });
  opener.focus();
  fireEvent.click(opener);

  const dialog = screen.getByRole('dialog', { name: 'KI-Systeme einordnen' });
  const close = within(dialog).getByRole('button', { name: 'Schließen' });
  expect(document.activeElement).toBe(close);
  expect(within(dialog).getByText('Unternehmen').closest('li')).toHaveAttribute('aria-current', 'step');

  const next = within(dialog).getByRole('button', { name: 'Weiter' });
  expect(next).toHaveAttribute('aria-disabled', 'true');

  // Tab vom letzten Element springt zurück zum ersten.
  next.focus();
  fireEvent.keyDown(next, { key: 'Tab' });
  expect(document.activeElement).toBe(close);

  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Muster GmbH' } });
  expect(next).toHaveAttribute('aria-disabled', 'false');
  fireEvent.click(next);

  expect(within(dialog).getByText('KI-Systeme').closest('li')).toHaveAttribute('aria-current', 'step');
  const uses = within(dialog).getByRole('group', { name: /Welche KI-Anwendungen/ });
  const first = within(uses).getAllByRole('button')[0];
  expect(first).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(first);
  expect(first).toHaveAttribute('aria-pressed', 'true');

  const role = within(within(dialog).getByRole('group', { name: /Ihre Rolle/ })).getAllByRole('button')[0];
  fireEvent.click(role);
  expect(role).toHaveAttribute('aria-pressed', 'true');

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(opener);
});

it('FAQ toggles do not read the plus sign aloud', () => {
  const { container } = mount();
  const marks = Array.from(container.querySelectorAll('summary > span'));
  expect(marks.length).toBeGreaterThan(0);
  for (const m of marks) expect(m).toHaveAttribute('aria-hidden', 'true');
});
