/**
 * Landing v6 (`/`) — Hero unter den Buttons.
 *
 * Vertrag: Direkt unter den Buttons steht, dass „ohne Konto“ für den Check
 * gilt. Der Hero verspricht nicht „alle Funktionen“ (bis WP-3 nur „kostenlos
 * testen“; der Beta-Hinweis selbst kommt aus #1892). Der Beispielbefund ist
 * als Beispiel gekennzeichnet und entspricht einer echten Scanner-Regel
 * (Titel, Schweregrad, Normbezug), damit die Landing nichts verspricht,
 * was der Prüfbericht nicht liefert.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6 } from '../../src/pages/LandingV6';

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

it('keeps the check hint right below the buttons and no all-features claim in the hero', () => {
  const { container } = mount();
  const primary = container.querySelector('[data-testid="hero-primary-cta"]');
  expect(primary).not.toBeNull();
  // Die Hinweiszeile folgt direkt auf die Button-Reihe und bezieht „ohne Konto“ auf den Check.
  expect(primary?.parentElement?.nextElementSibling).toHaveTextContent(
    'Check: Ergebnis in unter 90 Sekunden · ohne Konto · keine Kreditkarte',
  );
  // Textspalte des Heros (Kicker bis Beispielbefund); die Beta-Leiste oben prüft check:landing-claims.
  const column = primary?.parentElement?.parentElement;
  expect(column?.querySelector('h1')).not.toBeNull();
  expect(column).not.toHaveTextContent(/alle Funktionen/);
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
