/**
 * LangToggle: Label zeigt aktive → Zielsprache (nicht immer „DE → EN").
 * Gleiche Komponente für Desktop-Nav, Mobile-Nav und Handoff-TopBar.
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LangToggle } from '../../src/components/handoff/LangToggle';
import { resetLangForTests, setLang } from '../../src/i18n/useLang';

beforeEach(() => {
  localStorage.clear();
  resetLangForTests();
});
afterEach(() => {
  cleanup();
  resetLangForTests();
});

function labelText(): string {
  return (screen.getByTestId('lang-toggle').textContent ?? '').replace(/\s+/g, ' ').trim();
}

it('shows DE → EN when German is active (default)', () => {
  render(<LangToggle />);
  expect(screen.getByTestId('lang-toggle')).toHaveAttribute('data-lang', 'de');
  expect(labelText()).toBe('DE→EN');
});

it('shows EN → DE when English is active and updates immediately after toggle', () => {
  render(<LangToggle />);
  fireEvent.click(screen.getByTestId('lang-toggle'));
  expect(screen.getByTestId('lang-toggle')).toHaveAttribute('data-lang', 'en');
  expect(labelText()).toBe('EN→DE');
});

it('restores EN → DE from persisted language after remount', () => {
  setLang('en');
  cleanup();
  resetLangForTests();
  render(<LangToggle />);
  expect(screen.getByTestId('lang-toggle')).toHaveAttribute('data-lang', 'en');
  expect(labelText()).toBe('EN→DE');
  expect(localStorage.getItem('rsd-lang')).toBe('en');
});
