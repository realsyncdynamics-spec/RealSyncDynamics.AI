/**
 * Deutscher Pricing-Alias `/preise` darf nicht in NotFound landen.
 *
 * - Edge: public/_redirects 301 für vollen Seitenaufruf (inkl. trailing slash).
 * - SPA: Navigate in App.tsx für Client-Navigation (_redirects greift dort nicht).
 * - NotFound-CTA zeigt direkt auf /pricing (kein /preise-Loop).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { NotFoundPage } from '../../src/pages/NotFoundPage';

const ROOT = resolve(__dirname, '../..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
const redirects = readFileSync(resolve(ROOT, 'public/_redirects'), 'utf-8');
const notFound = readFileSync(resolve(ROOT, 'src/pages/NotFoundPage.tsx'), 'utf-8');

function routeLine(path: string): string {
  const line = app.split('\n').find((text) => text.includes(`path="${path}"`));
  expect(line, `Route ${path} nicht gefunden`).toBeDefined();
  return line ?? '';
}

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="loc">{pathname}</div>;
}

/** Spiegelt die App-Aliase — Client-Navigation ohne volles App-Mount. */
function AliasFixture({ initial }: { initial: string }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/preise" element={<Navigate to="/pricing" replace />} />
        <Route path="/preise/" element={<Navigate to="/pricing" replace />} />
        <Route
          path="/pricing"
          element={
            <>
              <div data-testid="pricing-page">Pricing</div>
              <LocationProbe />
            </>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Preise-Alias → /pricing', () => {
  it.each(['/preise', '/preise/'])(
    '%s leitet in App.tsx auf /pricing um (kein 404)',
    (path) => {
      expect(routeLine(path)).toContain('Navigate to="/pricing"');
    },
  );

  it.each(['/preise', '/preise/'])(
    'hat einen 301 in _redirects für %s',
    (path) => {
      expect(redirects).toMatch(new RegExp(`^${path}\\s+/pricing\\s+301`, 'm'));
    },
  );

  it('hält die kanonische Pricing-Route', () => {
    expect(routeLine('/pricing')).toContain('PricingPage');
  });
});

describe('Client-Navigation /preise', () => {
  it.each(['/preise', '/preise/'])(
    '%s landet clientseitig auf /pricing, nicht NotFound',
    (path) => {
      render(<AliasFixture initial={path} />);
      expect(screen.getByTestId('pricing-page')).toBeInTheDocument();
      expect(screen.getByTestId('loc')).toHaveTextContent('/pricing');
      expect(screen.queryByRole('heading', { name: /Seite nicht gefunden/i })).not.toBeInTheDocument();
    },
  );
});

describe('NotFound „Preise ansehen“', () => {
  it('zeigt auf /pricing direkt (kein /preise)', () => {
    expect(notFound).toContain('to="/pricing"');
    expect(notFound).not.toContain('to="/preise"');

    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Preise ansehen/i });
    expect(link).toHaveAttribute('href', '/pricing');
  });
});
