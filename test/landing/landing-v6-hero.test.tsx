/**
 * Landing v6 (`/`) — Hero unter den Buttons.
 *
 * Vertrag: Während der Beta steht der Beta-Hinweis direkt unter dem
 * Haupt-Button und führt in die Registrierung. Der Beispielbefund ist als
 * Beispiel gekennzeichnet und entspricht einer echten Scanner-Regel
 * (Titel, Schweregrad, Normbezug), damit die Landing nichts verspricht,
 * was der Prüfbericht nicht liefert.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6 } from '../../src/pages/LandingV6';
import { BETA } from '../../src/config/beta';

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
});

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <LandingV6 />
    </MemoryRouter>,
  );

it('shows the beta note right below the primary CTA and links into signup', () => {
  expect(BETA.active).toBe(true);
  const { container } = mount();
  const primary = container.querySelector('[data-testid="hero-primary-cta"]');
  const note = container.querySelector('[data-hero-beta-note]');
  expect(primary).not.toBeNull();
  expect(note).not.toBeNull();
  // Der Hinweis folgt direkt auf die Button-Reihe.
  expect(primary?.parentElement?.nextElementSibling).toBe(note);
  expect(note).toHaveTextContent(BETA.endsLabel);
  const link = note?.querySelector('a');
  const href = new URL(link?.getAttribute('href') ?? '', 'https://x.invalid');
  expect(href.pathname).toBe('/welcome');
  expect(href.searchParams.get('beta')).toBe('1');
});

it('labels the sample finding as an example and mirrors a real scanner rule', () => {
  const { container } = mount();
  const card = container.querySelector('[data-hero-sample-finding]');
  expect(card).not.toBeNull();
  expect(card).toHaveTextContent(/BEISPIELBEFUND/);
  expect(card).toHaveTextContent(/keine echte Website/);

  const rules = JSON.parse(readFileSync(resolve(__dirname, '../../src/rules/gdpr.json'), 'utf8'));
  const list: Array<{ id: string; title: string; severity: string; norms: string[] }> =
    Array.isArray(rules) ? rules : rules.rules;
  const rule = list.find((r) => r.id === 'GOOGLE_FONTS_EMBEDDED');
  expect(rule, 'Regel GOOGLE_FONTS_EMBEDDED fehlt — Beispielbefund anpassen').toBeDefined();
  expect(card).toHaveTextContent(rule!.title);
  expect(rule!.severity).toBe('medium');
  expect(card).toHaveTextContent('Schweregrad: mittel');
  expect(rule!.norms).toEqual(['DSGVO Art. 6 Abs. 1', 'DSGVO Art. 44']);
  expect(card).toHaveTextContent('DSGVO Art. 6 Abs. 1 · Art. 44');
});
