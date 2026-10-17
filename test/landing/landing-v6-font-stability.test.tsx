/**
 * Landing v6 (`/`) — obere Leiste ohne Schriftwechsel-Sprung.
 *
 * Befund 14.10.2026 (Lighthouse CLS 0,41 seit #1881): Die Leiste ist bei 1350 px
 * bis auf ~1 px gefüllt. Mit der Ersatzschrift bricht sie in zwei Zeilen um; kam
 * JetBrains Mono erst nach dem ersten Bild, sprang sie auf eine Zeile und zog die
 * Seite 27 px hoch. Vertrag: Die Leiste nutzt eine `font-display: optional`-Schrift
 * ohne Swap-Schrift davor, und genau diese Datei wird per preload angefordert.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingV6 } from '../../src/pages/LandingV6';

const FONT_URL = '/fonts/jetbrains-mono-latin.woff2';
const css = readFileSync(resolve(__dirname, '../../src/styles/landing-v6.css'), 'utf8');

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

it('declares the strip font with font-display: optional on the same file', () => {
  const face = css.match(/@font-face\s*\{[^}]*font-family:\s*'JetBrains Mono Optional'[^}]*\}/)?.[0] ?? '';
  expect(face).toMatch(/font-display:\s*optional/);
  expect(face).toContain(`url('${FONT_URL}')`);
});

it('sets the top strip in the optional font, with no swap face before the generic fallback', () => {
  mount();
  const label = screen.getAllByText('EU-gehostet · Frankfurt (eu-central-1)')[0];
  const strip = label.closest<HTMLElement>('[style*="font-family"]');
  expect(strip?.style.fontFamily).toMatch(/^['"]?JetBrains Mono Optional['"]?,\s*monospace$/);
});

it('preloads that font file in the document head', () => {
  mount();
  const link = document.head.querySelector(`link[rel="preload"][as="font"][href="${FONT_URL}"]`);
  expect(link).not.toBeNull();
  expect(link?.getAttribute('type')).toBe('font/woff2');
  expect(link?.hasAttribute('crossorigin')).toBe(true);
});
