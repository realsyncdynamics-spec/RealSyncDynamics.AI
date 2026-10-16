/**
 * Landing v6 (`/`) — Hero unter den Buttons.
 *
 * Vertrag: Die Beta-Frist steht direkt unter dem Haupt-Button (nicht nur in
 * der oberen Leiste), der Beispielbefund ist als Beispiel gekennzeichnet und
 * nennt das aktuelle Gesetz (TDDDG statt des abgelösten TTDSG). Das retuschierte
 * Kartenmotiv trägt einen neuen Dateinamen, weil Bilder eine Woche im
 * Browser-Cache liegen (public/_headers).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
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

it('shows the beta deadline right below the primary CTA while the beta runs', () => {
  mount();
  const note = screen.queryByTestId('hero-beta-note');
  if (!BETA.active) {
    expect(note).toBeNull();
    return;
  }
  expect(note).not.toBeNull();
  expect(note).toHaveTextContent(`Offene Beta bis ${BETA.endsLabel}: alle Funktionen kostenlos`);
  // Gleicher Hero-Block wie der Haupt-Button, nicht nur die obere Leiste.
  expect(screen.getByTestId('hero-primary-cta').closest('div')?.parentElement?.contains(note)).toBe(true);
});

it('labels the sample finding as an example and cites TDDDG, not TTDSG', () => {
  const { container } = mount();
  const sample = screen.getByTestId('hero-sample-finding');
  expect(sample).toHaveAccessibleName('Beispielbefund aus einem Prüfbericht');
  expect(within(sample).getByText(/BEISPIELBEFUND/)).toBeInTheDocument();
  expect(sample).toHaveTextContent('§ 25 Abs. 1 TDDDG');
  expect(container.textContent).not.toContain('TTDSG');
});

it('serves the retouched map under a new file name', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/landing-v6.css'), 'utf8');
  expect(css).toContain('/landing-v6/europe-network-v2.webp');
  expect(css).toContain('/landing-v6/europe-network-v2.jpg');
  expect(css).not.toMatch(/europe-network\.(webp|jpg)/);
});
