/**
 * Smoke-Tests für AuthPage — die vertraute Login-/Registrierungs-Seite,
 * die den früheren Redirect auf den /welcome-Wizard ersetzt.
 *
 * Strukturell: gerendert in einem MemoryRouter, Prüfung des Textinhalts.
 * Ohne Supabase-Konfiguration im Test → keine Netzwerk-/Auth-Aufrufe.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from '../../src/pages/AuthPage';

function renderText(mode: 'login' | 'register'): string {
  const result = render(
    <MemoryRouter initialEntries={[mode === 'login' ? '/login' : '/register']}>
      <AuthPage mode={mode} />
    </MemoryRouter>,
  );
  return result.container.textContent ?? '';
}

describe('AuthPage', () => {
  it('zeigt im Login-Modus eine vertraute Anmeldemaske', () => {
    const text = renderText('login');
    expect(text).toContain('Willkommen zurück');
    expect(text).toContain('E-Mail');
    expect(text).toContain('Passwort');
    expect(text).toContain('Anmelden');
    expect(text).toContain('Passwort vergessen?');
    expect(text).toContain('Angemeldet bleiben');
  });

  it('bietet einen Passwort-anzeigen-Umschalter', () => {
    const result = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );
    // Auge-Toggle ist per aria-label auffindbar
    expect(result.container.querySelector('[aria-label="Passwort anzeigen"]')).not.toBeNull();
  });

  it('bietet Google als OAuth-Option an', () => {
    const text = renderText('login');
    expect(text).toContain('Mit Google fortfahren');
  });

  it('zeigt im Register-Modus die Konto-Erstellung', () => {
    const text = renderText('register');
    expect(text).toContain('Konto erstellen');
    // Im Register-Modus kein „Passwort vergessen"
    expect(text).not.toContain('Passwort vergessen?');
  });
});
