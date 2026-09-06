import { describe, it, expect } from 'vitest';
import {
  resolveCustomerDestination,
  isSafeInternalPath,
  hasAuthCallbackArtifacts,
  WELCOME_PATH,
  CUSTOMER_HOME_PATH,
} from '../../src/core/access/customer-destination';

describe('resolveCustomerDestination', () => {
  it('ohne Sitzung führt der Einstieg auf die Anmeldefläche', () => {
    const ziel = resolveCustomerDestination({ hasSession: false });
    expect(ziel).toEqual({ kind: 'onboarding', path: WELCOME_PATH });
  });

  // Der Befund, den diese Datei absichert: Ein Bestandskunde klickte „Login"
  // und landete in Schritt 2 des Einrichtungs-Assistenten.
  it('mit Sitzung und ohne Auftrag führt der Einstieg in den Arbeitsbereich', () => {
    const ziel = resolveCustomerDestination({ hasSession: true });
    expect(ziel).toEqual({ kind: 'workspace', path: CUSTOMER_HOME_PATH });
  });

  it('solange die Sitzung aufgelöst wird, gibt es kein Ziel', () => {
    const ziel = resolveCustomerDestination({ hasSession: false, isLoading: true });
    expect(ziel.kind).toBe('pending');
    expect(ziel.path).toBeNull();
  });

  // Post-Checkout-Wizard bleibt unangetastet: `?session=` schlägt alles.
  it('mit `?session=` bleibt es beim Einrichtungs-Assistenten', () => {
    expect(
      resolveCustomerDestination({ hasSession: true, checkoutSessionId: 'cs_test_123' }),
    ).toEqual({ kind: 'checkout-setup', path: WELCOME_PATH });
  });

  it('`?session=` schlägt auch ein gesetztes `?next=`', () => {
    const ziel = resolveCustomerDestination({
      hasSession: true,
      checkoutSessionId: 'cs_test_123',
      nextParam: '/app/websites',
    });
    expect(ziel.kind).toBe('checkout-setup');
  });

  // Ohne diese Regel überspränge ein Neukunde nach dem Magic-Link genau die
  // Einrichtung, für die er gekommen ist.
  it('die Rückkehr aus einem Auth-Callback bleibt auf der Anmeldefläche', () => {
    const ziel = resolveCustomerDestination({
      hasSession: true,
      arrivedFromAuthCallback: true,
    });
    expect(ziel).toEqual({ kind: 'onboarding', path: WELCOME_PATH });
  });

  it('ein sicheres `?next=` gewinnt gegen den Arbeitsbereich', () => {
    expect(
      resolveCustomerDestination({ hasSession: true, nextParam: '/app/evidence' }),
    ).toEqual({ kind: 'next', path: '/app/evidence' });
  });

  it('ein fremdes `?next=` wird verworfen, nicht gefolgt', () => {
    for (const boese of ['//fremde.seite', 'https://fremde.seite', '/\\fremde.seite', '']) {
      const ziel = resolveCustomerDestination({ hasSession: true, nextParam: boese });
      expect(ziel, boese).toEqual({ kind: 'workspace', path: CUSTOMER_HOME_PATH });
    }
  });

  it('ohne Sitzung wird `?next=` nicht zum Ziel — erst anmelden', () => {
    const ziel = resolveCustomerDestination({ hasSession: false, nextParam: '/app/evidence' });
    expect(ziel.kind).toBe('onboarding');
  });
});

describe('isSafeInternalPath', () => {
  it('akzeptiert seiteneigene Pfade', () => {
    expect(isSafeInternalPath('/app/dashboard')).toBe(true);
    expect(isSafeInternalPath('/checkout/starter?pilot=true')).toBe(true);
  });

  it('weist alles zurück, was die Seite verlassen könnte', () => {
    expect(isSafeInternalPath('//fremde.seite')).toBe(false);
    expect(isSafeInternalPath('/\\fremde.seite')).toBe(false);
    expect(isSafeInternalPath('https://fremde.seite')).toBe(false);
    expect(isSafeInternalPath('javascript:alert(1)')).toBe(false);
    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath('')).toBe(false);
  });
});

describe('hasAuthCallbackArtifacts', () => {
  it('erkennt den impliziten Rückweg im Hash', () => {
    expect(
      hasAuthCallbackArtifacts('', '#access_token=abc&expires_in=3600&type=magiclink'),
    ).toBe(true);
    expect(hasAuthCallbackArtifacts('', '#refresh_token=abc')).toBe(true);
  });

  it('erkennt den PKCE-/OAuth-Rückweg im Query', () => {
    expect(hasAuthCallbackArtifacts('?code=abc123', '')).toBe(true);
    expect(hasAuthCallbackArtifacts('?token_hash=abc', '')).toBe(true);
    expect(hasAuthCallbackArtifacts('?error_code=otp_expired', '')).toBe(true);
  });

  it('hält den normalen Aufruf der Seite auseinander', () => {
    expect(hasAuthCallbackArtifacts('', '')).toBe(false);
    expect(hasAuthCallbackArtifacts('?next=/app/evidence', '')).toBe(false);
    expect(hasAuthCallbackArtifacts('?session=cs_test_123', '')).toBe(false);
    // Ein Parameter, der die Marker nur als Teilwort enthält, zählt nicht.
    expect(hasAuthCallbackArtifacts('?discount_code=abc', '')).toBe(false);
  });
});
