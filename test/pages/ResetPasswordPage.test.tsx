/**
 * Smoke-Test für ResetPasswordPage — schließt den „Passwort vergessen"-Flow ab.
 *
 * Ohne Supabase-Konfiguration im Test besteht keine Recovery-Session →
 * die Seite zeigt den „kein gültiger Recovery-Link"-Zustand mit Rückweg
 * zur Anmeldung. Strukturell, im MemoryRouter.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from '../../src/pages/ResetPasswordPage';

describe('ResetPasswordPage', () => {
  it('rendert die Überschrift und ohne Recovery-Session den Rückweg', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/reset']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Neues Passwort');
    expect(text).toContain('Zurück zur Anmeldung');
  });
});
