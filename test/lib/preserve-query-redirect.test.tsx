/**
 * Der Pilot-Flow hängt daran, dass Query-Parameter Redirect-Ketten überleben.
 *
 * `<Navigate to="/welcome" replace />` verwirft `location.search`. Damit ging
 * `?intent=pilot&audit_id=…&domain=…` auf dem Weg von der Audit-CTA zur
 * Anmeldung verloren — die Aktivierung wurde nie ausgelöst. Dasselbe galt für
 * `?welcome=pilot&domain=…` über die Alias-Kette /dashboard → /app →
 * /app/dashboard.
 *
 * Diese Tests sind die Regression-Sperre dagegen.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { PreserveQueryRedirect } from '../../src/components/PreserveQueryRedirect';

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="loc">{`${pathname}${search}${hash}`}</div>;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        {/* Auth-Aliase — wie in src/App.tsx */}
        <Route path="/login" element={<PreserveQueryRedirect to="/welcome" />} />
        <Route path="/signin" element={<PreserveQueryRedirect to="/welcome" />} />
        <Route path="/signup" element={<PreserveQueryRedirect to="/welcome" />} />
        <Route path="/register" element={<PreserveQueryRedirect to="/welcome" />} />
        {/* Dashboard-Aliase — zweistufige Kette */}
        <Route path="/dashboard" element={<PreserveQueryRedirect to="/app" />} />
        <Route path="/app" element={<PreserveQueryRedirect to="/app/dashboard" />} />
        <Route path="/welcome" element={<LocationProbe />} />
        <Route path="/app/dashboard" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PreserveQueryRedirect', () => {
  it('trägt den Pilot-Kontext von /login nach /welcome', () => {
    const query = '?intent=pilot&audit_id=abc-123&domain=example.com&source=audit_cta';
    renderAt(`/login${query}`);

    const loc = screen.getByTestId('loc').textContent ?? '';
    expect(loc.startsWith('/welcome')).toBe(true);

    const params = new URLSearchParams(loc.split('?')[1]);
    expect(params.get('intent')).toBe('pilot');
    expect(params.get('audit_id')).toBe('abc-123');
    expect(params.get('domain')).toBe('example.com');
  });

  it.each(['/signin', '/signup', '/register'])('erhält die Query auch auf %s', (path) => {
    renderAt(`${path}?intent=pilot&audit_id=abc-123&domain=example.com`);
    expect(screen.getByTestId('loc').textContent).toContain('intent=pilot');
  });

  it('überlebt die zweistufige Kette /dashboard → /app → /app/dashboard', () => {
    renderAt('/dashboard?welcome=pilot&domain=example.com');

    const loc = screen.getByTestId('loc').textContent ?? '';
    expect(loc.startsWith('/app/dashboard')).toBe(true);

    const params = new URLSearchParams(loc.split('?')[1]);
    expect(params.get('welcome')).toBe('pilot');
    expect(params.get('domain')).toBe('example.com');
  });

  it('reicht den Hash durch — Supabase liefert Auth-Fehler als #error=…', () => {
    renderAt('/login?intent=pilot#error=access_denied');
    const loc = screen.getByTestId('loc').textContent ?? '';
    expect(loc).toContain('#error=access_denied');
    expect(loc).toContain('intent=pilot');
  });

  it('funktioniert ohne Query unverändert', () => {
    renderAt('/login');
    expect(screen.getByTestId('loc').textContent).toBe('/welcome');
  });

  it('belegt die Regression: nacktes <Navigate> verlöre die Query', () => {
    // Kontrollgruppe — dokumentiert, warum es diese Komponente überhaupt gibt.
    render(
      <MemoryRouter initialEntries={['/login?intent=pilot&audit_id=abc-123']}>
        <Routes>
          <Route path="/login" element={<Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('loc').textContent).toBe('/welcome');
  });
});
