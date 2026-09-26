import { describe, it, expect } from 'vitest';
import {
  resolveCustomerDestination,
  journeyModeFromEnv,
  JOURNEY_ROUTES,
  type JourneySnapshot,
} from '../../src/core/journey/resolveCustomerDestination';

function snap(over: Partial<JourneySnapshot> = {}): JourneySnapshot {
  return { authenticated: true, intendedPath: '/app/dashboard', ...over };
}

describe('Vorgabemodus off — das bisherige Verhalten von AppGate, unveraendert', () => {
  it('schickt Nicht-Angemeldete nach /welcome, mit dem Ziel als next', () => {
    const d = resolveCustomerDestination(snap({ authenticated: false, intendedPath: '/app/evidence?tab=chain' }));
    expect(d).toEqual({
      kind: 'redirect',
      to: '/welcome?next=%2Fapp%2Fevidence%3Ftab%3Dchain',
      reason: 'unauthenticated',
    });
  });

  it('laesst Angemeldete durch', () => {
    expect(resolveCustomerDestination(snap())).toEqual({ kind: 'proceed', reason: 'proceed' });
  });

  // Der Kern der Zusage "additiv": Im Vorgabemodus darf kein einziger der
  // neuen Zustaende eine Weiterleitung ausloesen. Faellt dieser Test, hat
  // jemand unbemerkt das Verhalten fuer Bestandskunden geaendert.
  it('ignoriert Tenant, Onboarding und Checkout vollstaendig', () => {
    const d = resolveCustomerDestination(
      snap({
        tenantId: null,
        onboarding: { step: 1, completedAt: null },
        pendingCheckoutPlanKey: 'growth',
        subscriptionStatus: 'canceled',
      }),
    );
    expect(d).toEqual({ kind: 'proceed', reason: 'proceed' });
  });
});

describe('enforce — die Sprossenleiter', () => {
  const E = 'enforce' as const;

  it('Sprosse 1 gilt auch hier: nicht angemeldet schlaegt alles andere', () => {
    const d = resolveCustomerDestination(
      snap({ authenticated: false, intendedPath: '/app/dashboard', tenantId: 't1' }),
      E,
    );
    expect(d.kind).toBe('redirect');
    expect(d).toMatchObject({ reason: 'unauthenticated' });
  });

  it('kein Tenant fuehrt ins Onboarding', () => {
    const d = resolveCustomerDestination(snap({ tenantId: null }), E);
    expect(d).toEqual({ kind: 'redirect', to: JOURNEY_ROUTES.onboarding, reason: 'no-tenant' });
  });

  it('unvollstaendiges Onboarding fuehrt ins Onboarding', () => {
    const d = resolveCustomerDestination(
      snap({ tenantId: 't1', onboarding: { step: 2, completedAt: null } }),
      E,
    );
    expect(d).toEqual({ kind: 'redirect', to: JOURNEY_ROUTES.onboarding, reason: 'onboarding-incomplete' });
  });

  it('offener Checkout fuehrt zur Wiederaufnahme mit demselben Plan', () => {
    const d = resolveCustomerDestination(
      snap({
        tenantId: 't1',
        onboarding: { step: 4, completedAt: '2026-09-01T10:00:00Z' },
        pendingCheckoutPlanKey: 'growth',
        subscriptionStatus: null,
      }),
      E,
    );
    expect(d).toEqual({ kind: 'redirect', to: '/checkout/growth', reason: 'checkout-pending' });
  });

  it('fertiger Kunde geht durch — kein Umweg ueber Onboarding oder Pricing', () => {
    const d = resolveCustomerDestination(
      snap({
        tenantId: 't1',
        onboarding: { step: 4, completedAt: '2026-09-01T10:00:00Z' },
        subscriptionStatus: 'active',
      }),
      E,
    );
    expect(d).toEqual({ kind: 'proceed', reason: 'proceed' });
  });

  // Reihenfolge ist Vertrag: erst wissen, was der Kunde braucht, dann kaufen.
  it('Onboarding schlaegt Checkout, wenn beides offen ist', () => {
    const d = resolveCustomerDestination(
      snap({ tenantId: 't1', onboarding: { step: 1, completedAt: null }, pendingCheckoutPlanKey: 'growth' }),
      E,
    );
    expect(d).toMatchObject({ to: JOURNEY_ROUTES.onboarding, reason: 'onboarding-incomplete' });
  });
});

describe('enforce — die Faelle, in denen NICHT weitergeleitet wird', () => {
  const E = 'enforce' as const;

  // Ohne diese Pruefung leitet "Onboarding unvollstaendig" auf /app/onboarding
  // und dort sofort wieder — eine Schleife, die der Nutzer als haengende
  // Seite erlebt.
  it('wer schon auf dem Ziel steht, wird nicht erneut dorthin geschickt', () => {
    const d = resolveCustomerDestination(
      snap({ intendedPath: '/app/onboarding', tenantId: 't1', onboarding: { step: 1, completedAt: null } }),
      E,
    );
    expect(d).toEqual({ kind: 'proceed', reason: 'already-there' });
  });

  it('das gilt auch fuer Unterpfade des Ziels', () => {
    const d = resolveCustomerDestination(
      snap({ intendedPath: '/checkout/growth/confirm', tenantId: 't1', pendingCheckoutPlanKey: 'growth' }),
      E,
    );
    expect(d).toEqual({ kind: 'proceed', reason: 'already-there' });
  });

  // `undefined` heisst "nicht mitgebracht", `null` heisst "nicht vorhanden".
  // Die Unterscheidung verhindert, dass ein Aufrufer, der eine Angabe gar
  // nicht laden kann, den Nutzer aus Versehen ins Onboarding schickt.
  it('nicht mitgebrachte Angaben loesen keine Weiterleitung aus', () => {
    expect(resolveCustomerDestination(snap({ tenantId: 't1' }), E)).toEqual({
      kind: 'proceed',
      reason: 'proceed',
    });
  });

  it('Zahlungsverzug sperrt nicht aus — dafuer gibt es die Kulanzfrist', () => {
    const d = resolveCustomerDestination(
      snap({ tenantId: 't1', pendingCheckoutPlanKey: 'growth', subscriptionStatus: 'past_due' }),
      E,
    );
    expect(d).toEqual({ kind: 'proceed', reason: 'proceed' });
  });

  it('ein leerer Plan-Schluessel ist kein offener Checkout', () => {
    const d = resolveCustomerDestination(snap({ tenantId: 't1', pendingCheckoutPlanKey: '' }), E);
    expect(d).toEqual({ kind: 'proceed', reason: 'proceed' });
  });
});

describe('journeyModeFromEnv', () => {
  it('nur der ausdrueckliche Wert enforce schaltet scharf', () => {
    expect(journeyModeFromEnv('enforce')).toBe('enforce');
  });

  it.each([undefined, null, '', 'shadow', 'on', 'true', 'ENFORCE'])('%s faellt auf off zurueck', (raw) => {
    expect(journeyModeFromEnv(raw as string | null | undefined)).toBe('off');
  });
});
