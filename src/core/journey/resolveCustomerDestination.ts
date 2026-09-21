/**
 * Journey-Resolver — die eine Stelle, an der entschieden wird, wohin ein
 * Kunde gehoert.
 *
 * Zweck (Produktgrundsatz): Nicht der Kunde navigiert unsere Architektur,
 * sondern die Architektur navigiert den Kunden. Heute liegt diese
 * Entscheidung verstreut in einzelnen Komponenten; `AppGate` etwa kannte
 * bis hierher nur "eingeloggt ja/nein".
 *
 * Diese Datei ist bewusst eine REINE Funktion: kein React, kein Supabase,
 * kein Netz. Wer sie aufruft, bringt den Zustand mit. Das macht die
 * Entscheidung testbar, ohne eine Datenbank zu stellen — und verhindert,
 * dass die Regel ein zweites Mal irgendwo nachgebaut wird.
 *
 * ⚠️ WIRKSAMKEIT: Der Vorgabemodus ist `off`. Dann wertet der Resolver
 * ausschliesslich die Auth-Sprosse aus und verhaelt sich damit exakt wie
 * `AppGate` vorher. Die uebrigen Sprossen sind implementiert und geprueft,
 * aber erst scharf, wenn jemand `enforce` setzt UND der Aufrufer die
 * dafuer noetigen Daten (Tenant, Abo, Onboarding) tatsaechlich mitbringt.
 * Das ist Absicht: Eine Weiterleitung nach `/app/onboarding` ist eine
 * Funktionsaenderung an Bestehendem und nach CLAUDE.md §10.3
 * fragepflichtig.
 *
 * Kein `shadow`-Modus. Ein Beobachtungsmodus ohne Senke, in die er
 * schreibt, ist keine Messung, sondern eine Behauptung — genau der Fehler,
 * den CLAUDE.md §5 fuer `pdp_shadow_log` festhaelt ("Ein leeres
 * Shadow-Protokoll bedeutet nicht 'keine Abweichungen'"). Entweder es gibt
 * eine Senke, dann bekommt sie einen eigenen Schnitt, oder es gibt keinen
 * Beobachtungsmodus.
 */

/** Abo-Status, wie ihn `public.subscriptions.status` fuehrt (Stripe-Vokabular). */
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'canceled';

/**
 * Der Zustand, aus dem entschieden wird. Alles ausser `authenticated` und
 * `intendedPath` ist nullbar — `null` heisst ausdruecklich "nicht
 * feststellbar", nicht "nein". Wer eine Sprosse nicht belegen kann, laesst
 * sie weg; der Resolver ueberspringt sie dann, statt zu raten.
 */
export interface JourneySnapshot {
  /** Supabase-Session vorhanden? */
  authenticated: boolean;
  /** Pfad samt Query, den der Nutzer tatsaechlich aufgerufen hat. */
  intendedPath: string;
  /** Arbeitsbereich des Nutzers. `null` = keiner ermittelt. */
  tenantId?: string | null;
  /** Status des einen Abos des Tenants (`UNIQUE(tenant_id)`). */
  subscriptionStatus?: SubscriptionStatus | null;
  /** Fortschritt aus `customer_onboarding` (Spalten `step`, `completed_at`). */
  onboarding?: { step: number; completedAt: string | null } | null;
  /** Gewaehlter, aber noch nicht bezahlter Plan — fuer die Wiederaufnahme. */
  pendingCheckoutPlanKey?: string | null;
}

/** Warum der Resolver so entschieden hat — fuer Protokoll und Tests. */
export type JourneyReason =
  | 'unauthenticated'
  | 'no-tenant'
  | 'onboarding-incomplete'
  | 'checkout-pending'
  | 'already-there'
  | 'proceed';

export type JourneyDestination =
  | { kind: 'proceed'; reason: JourneyReason }
  | { kind: 'redirect'; to: string; reason: JourneyReason };

export type JourneyMode = 'off' | 'enforce';

/** Kanonische Ziele. Alle vier Routen existieren in `src/App.tsx`. */
export const JOURNEY_ROUTES = {
  auth: '/welcome',
  onboarding: '/app/onboarding',
  dashboard: '/app/dashboard',
  checkout: (planKey: string) => `/checkout/${planKey}`,
} as const;

/** Abo-Status, die als bezahlt gelten. `past_due` zaehlt dazu: Zahlungsverzug
 *  sperrt nicht sofort aus — die Kulanzfrist regelt `20260829000000_grace_period`. */
const PAID_STATUS: ReadonlySet<SubscriptionStatus> = new Set<SubscriptionStatus>([
  'trialing',
  'active',
  'past_due',
]);

/** Nur der Pfadteil, ohne Query — fuer den Vergleich mit dem Ziel. */
function pathOf(intendedPath: string): string {
  const q = intendedPath.indexOf('?');
  return q === -1 ? intendedPath : intendedPath.slice(0, q);
}

/**
 * Schuetzt vor der Endlosschleife: Wer bereits auf dem Ziel steht (oder
 * darunter), wird nicht erneut dorthin geschickt. Ohne diese Pruefung
 * wuerde etwa "Onboarding unvollstaendig" den Nutzer auf `/app/onboarding`
 * leiten — und dort sofort wieder.
 */
function isAlreadyAt(intendedPath: string, target: string): boolean {
  const p = pathOf(intendedPath);
  return p === target || p.startsWith(`${target}/`);
}

function redirectTo(target: string, reason: JourneyReason, intendedPath: string): JourneyDestination {
  if (isAlreadyAt(intendedPath, target)) {
    return { kind: 'proceed', reason: 'already-there' };
  }
  return { kind: 'redirect', to: target, reason };
}

/**
 * Entscheidet deterministisch, wohin der Kunde gehoert.
 *
 * Die Reihenfolge der Sprossen ist Vertrag, nicht Geschmack — sie folgt
 * dem Zielbild "ein Einstieg → Konto → Onboarding → Checkout → Dashboard":
 *
 *   1. nicht eingeloggt        → /welcome?next=<Ziel>
 *   2. kein Tenant             → /app/onboarding
 *   3. Onboarding unvollstaendig → /app/onboarding
 *   4. Checkout offen          → /checkout/<planKey>
 *   5. sonst                   → weiterleiten lassen (proceed)
 *
 * Onboarding steht bewusst VOR Checkout: Erst wenn feststeht, was der
 * Kunde braucht, ist die Kaufentscheidung sinnvoll.
 */
export function resolveCustomerDestination(
  snapshot: JourneySnapshot,
  mode: JourneyMode = 'off',
): JourneyDestination {
  const { authenticated, intendedPath } = snapshot;

  // Sprosse 1 gilt in JEDEM Modus — sie ist das bisherige Verhalten von AppGate.
  if (!authenticated) {
    const next = encodeURIComponent(intendedPath);
    return { kind: 'redirect', to: `${JOURNEY_ROUTES.auth}?next=${next}`, reason: 'unauthenticated' };
  }

  if (mode === 'off') {
    return { kind: 'proceed', reason: 'proceed' };
  }

  // Ab hier: nur auswerten, was der Aufrufer auch belegt hat. `undefined`
  // heisst "nicht mitgebracht" und darf keine Weiterleitung ausloesen.
  if (snapshot.tenantId === null) {
    return redirectTo(JOURNEY_ROUTES.onboarding, 'no-tenant', intendedPath);
  }

  const onboarding = snapshot.onboarding;
  if (onboarding != null && onboarding.completedAt == null) {
    return redirectTo(JOURNEY_ROUTES.onboarding, 'onboarding-incomplete', intendedPath);
  }

  const planKey = snapshot.pendingCheckoutPlanKey;
  const status = snapshot.subscriptionStatus;
  const paid = status != null && PAID_STATUS.has(status);
  if (planKey != null && planKey !== '' && !paid) {
    return redirectTo(JOURNEY_ROUTES.checkout(planKey), 'checkout-pending', intendedPath);
  }

  return { kind: 'proceed', reason: 'proceed' };
}

/**
 * Modus aus der Umgebung. Vorgabe `off` — ohne ausdrueckliches Setzen
 * aendert sich kein Verhalten. Unbekannte Werte fallen auf `off` zurueck
 * statt zu raten.
 */
export function journeyModeFromEnv(raw?: string | null): JourneyMode {
  return raw === 'enforce' ? 'enforce' : 'off';
}
