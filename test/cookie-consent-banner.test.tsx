/**
 * Cookie-Banner (src/components/CookieConsent.tsx).
 *
 * Deckt die im Compliance-Sprint geforderten Szenarien ab:
 *   - neuer Besucher
 *   - wiederkehrender Besucher
 *   - Ablehnen
 *   - Akzeptieren
 *   - Einstellungen ändern (inkl. Vorbefüllung beim Widerruf)
 *
 * Zusätzlich: Gleichrangigkeit von Annehmen/Ablehnen (keine Dark Patterns)
 * und Versionierung der Einwilligung.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieConsent, openCookieSettings, CONSENT_VERSION } from '../src/components/CookieConsent';

const STORAGE_KEY = 'realsync.cookie-consent.v1';

vi.mock('../src/lib/pixels', () => ({ emitConsentChanged: vi.fn() }));

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieConsent />
    </MemoryRouter>,
  );
}

function storedConsent() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('CookieConsent', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('zeigt dem neuen Besucher den Banner', () => {
    renderBanner();
    expect(screen.getByTestId('consent-accept-all')).toBeInTheDocument();
    expect(screen.getByTestId('consent-reject-all')).toBeInTheDocument();
  });

  it('zeigt dem wiederkehrenden Besucher mit gültiger Einwilligung keinen Banner', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics: true,
      marketing: false,
    }));

    renderBanner();
    expect(screen.queryByTestId('consent-accept-all')).not.toBeInTheDocument();
  });

  it('speichert bei „Alle ablehnen" keine optionalen Kategorien', () => {
    renderBanner();
    fireEvent.click(screen.getByTestId('consent-reject-all'));

    const consent = storedConsent();
    expect(consent.analytics).toBe(false);
    expect(consent.marketing).toBe(false);
    expect(consent.necessary).toBe(true);
  });

  it('speichert bei „Alles akzeptieren" alle Kategorien', () => {
    renderBanner();
    fireEvent.click(screen.getByTestId('consent-accept-all'));

    const consent = storedConsent();
    expect(consent.analytics).toBe(true);
    expect(consent.marketing).toBe(true);
  });

  it('schreibt die Consent-Version mit (Art. 7 I Nachweisbarkeit)', () => {
    renderBanner();
    fireEvent.click(screen.getByTestId('consent-accept-all'));

    const consent = storedConsent();
    expect(consent.version).toBe(CONSENT_VERSION);
    expect(typeof consent.decided_at).toBe('string');
    expect(Number.isNaN(Date.parse(consent.decided_at))).toBe(false);
  });

  it('behandelt Annehmen und Ablehnen gleichrangig (keine Dark Patterns)', () => {
    renderBanner();
    const accept = screen.getByTestId('consent-accept-all');
    const reject = screen.getByTestId('consent-reject-all');

    // Gleiche Breitenklasse und gleiche visuelle Gewichtung.
    expect(accept.className).toContain('flex-1');
    expect(reject.className).toContain('flex-1');
    expect(reject.className.replace('consent-reject', '')).toBe(
      accept.className.replace('consent-accept', ''),
    );
  });

  it('erlaubt eine granulare Auswahl über die Einstellungen', () => {
    renderBanner();
    fireEvent.click(screen.getByTestId('consent-settings'));

    // „Statistik" aktivieren, „Marketing" ausgelassen.
    fireEvent.click(screen.getByRole('checkbox', { name: /Statistik/ }));
    fireEvent.click(screen.getByRole('button', { name: /Auswahl speichern/ }));

    const consent = storedConsent();
    expect(consent.analytics).toBe(true);
    expect(consent.marketing).toBe(false);
  });

  it('befüllt die Einstellungen beim Widerruf mit der gespeicherten Auswahl vor', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics: true,
      marketing: false,
    }));

    renderBanner();
    // Banner ist zunächst ausgeblendet; Widerruf erfolgt über den Footer-Link.
    expect(screen.queryByTestId('consent-accept-all')).not.toBeInTheDocument();
    act(() => openCookieSettings());

    const statistik = screen.getByRole('checkbox', { name: /Statistik/ }) as HTMLInputElement;
    const marketing = screen.getByRole('checkbox', { name: /Marketing/ }) as HTMLInputElement;

    // Ist-Zustand muss sichtbar sein — sonst widerruft der Nutzer versehentlich.
    expect(statistik.checked).toBe(true);
    expect(marketing.checked).toBe(false);
  });

  it('fragt bei veralteter Consent-Version erneut', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION - 1,
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics: true,
      marketing: true,
    }));

    renderBanner();
    expect(screen.getByTestId('consent-accept-all')).toBeInTheDocument();
  });

  it('behandelt Altbestände ohne Versionsfeld als gültig (kein erneutes Fragen)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics: false,
      marketing: false,
    }));

    renderBanner();
    expect(screen.queryByTestId('consent-accept-all')).not.toBeInTheDocument();
  });
});
