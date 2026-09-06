// Ziel-Auflösung für den Einstieg eines wiederkehrenden Kunden — REINE Logik,
// keine React- und keine Supabase-Abhängigkeit, damit sie unit-testbar ist
// (analog `aal2-policy.ts`).
//
// ## Der Befund, den diese Datei behebt
//
// `/welcome` ist zwei Dinge in einer Route: der Einrichtungs-Assistent nach
// dem Stripe-Checkout **und** der einzige Login-Einstieg der Seite (die
// Kopfzeile verlinkt dorthin, `/login`, `/signin`, `/signup` und `/register`
// leiten dorthin um). Für einen Neukunden stimmt das. Für einen bestehenden
// Kunden, der bereits angemeldet ist, nicht: Er klickte „Login" und landete
// in Schritt 2 des Onboardings — API-Schlüssel erzeugen, Cookie-SDK
// einbinden, Domain verbinden. Also in einer Einrichtung, die er längst
// hinter sich hat, statt in seinem Arbeitsbereich.
//
// Der Wizard selbst bleibt unangetastet; er ist richtig für den Fall, für den
// er gebaut wurde. Was fehlte, war die Unterscheidung davor.
//
// ## Was hier entschieden wird — und was nicht
//
// Diese Funktion entscheidet **nur** über das Ziel. Ob eine Sitzung besteht,
// liest der Aufrufer; ob der Nutzer die Zielroute betreten darf, entscheidet
// weiterhin `AppGate` bzw. `RouteEntitlementGate` dort.

/** Die kanonische Anmeldefläche. */
export const WELCOME_PATH = '/welcome';

/** Das Arbeitsbereich-Zuhause eines angemeldeten Kunden. */
export const CUSTOMER_HOME_PATH = '/app/dashboard';

/** Beschriftung des Einstiegspunkts ohne Sitzung. */
export const LOGIN_LINK_LABEL = 'Login';

/** Beschriftung des Einstiegspunkts mit Sitzung. */
export const WORKSPACE_LINK_LABEL = 'Zum Dashboard';

export interface CustomerDestinationInput {
  /** Besteht eine Supabase-Sitzung? */
  hasSession: boolean;
  /**
   * Wird die Sitzung gerade erst aufgelöst? Dann steht die Antwort noch nicht
   * fest — der Aufrufer darf nicht voreilig umleiten und nicht voreilig den
   * Login anbieten.
   */
  isLoading?: boolean;
  /**
   * Die Stripe-Checkout-Sitzung aus `?session=`. Ist sie gesetzt, gehört der
   * Besucher in den Einrichtungs-Assistenten — auch wenn er angemeldet ist.
   * Das ist der Post-Checkout-Fall, für den `/welcome` gebaut ist.
   */
  checkoutSessionId?: string | null;
  /**
   * Der Rücksprungpfad aus `?next=` (z. B. von `AppGate` gesetzt). Hat
   * Vorrang vor dem Arbeitsbereich, sobald eine Sitzung besteht.
   */
  nextParam?: string | null;
  /**
   * Kommt der Besucher gerade aus einem Auth-Callback (Magic-Link, OAuth)?
   * Dann ist er zwar angemeldet, aber mitten in einer Anmeldung, die auf
   * dieser Seite endet — er bleibt, wo er ist. Siehe
   * `hasAuthCallbackArtifacts`.
   */
  arrivedFromAuthCallback?: boolean;
}

export type CustomerDestination =
  /** Noch keine Entscheidung möglich — Sitzung wird aufgelöst. */
  | { kind: 'pending'; path: null }
  /** Anmelden bzw. Konto anlegen: der Assistent auf `/welcome`. */
  | { kind: 'onboarding'; path: string }
  /** Post-Checkout-Einrichtung: der Assistent, mit Checkout-Sitzung. */
  | { kind: 'checkout-setup'; path: string }
  /** Ausdrücklicher Rücksprung aus `?next=`. */
  | { kind: 'next'; path: string }
  /** Bestehender Kunde ohne besonderen Auftrag → Arbeitsbereich. */
  | { kind: 'workspace'; path: string };

/**
 * Nur seiteneigene Pfade sind als Rücksprungziel zulässig: beginnend mit `/`,
 * aber nicht mit `//` und nicht mit `/\` — sonst wäre `?next=//fremde.seite`
 * ein Open Redirect direkt nach der Anmeldung. Dieselbe Schranke wie in
 * `Welcome.tsx`; sie steht jetzt an einer Stelle statt an dreien.
 */
export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//') || value.startsWith('/\\')) return false;
  return true;
}

/**
 * Wohin gehört dieser Besucher?
 *
 * Reihenfolge der Entscheidung — die erste zutreffende gewinnt:
 *
 * 1. Sitzung wird noch aufgelöst → `pending`. Nichts tun, nichts anzeigen,
 *    was sich gleich widerruft.
 * 2. `?session=` gesetzt → `checkout-setup`. Der Post-Checkout-Assistent hat
 *    Vorrang vor allem anderen; ein frisch zahlender Kunde ist zwangsläufig
 *    auch angemeldet, und trotzdem gehört er in die Einrichtung.
 * 3. Rückkehr aus einem Auth-Callback → `onboarding`. Die Anmeldung endet auf
 *    dieser Seite; wer sie gerade abschließt, wird nicht weggeschickt.
 * 4. Keine Sitzung → `onboarding`. Anmelden bzw. Konto anlegen.
 * 5. Sitzung + sicheres `?next=` → dorthin zurück.
 * 6. Sitzung, sonst nichts → `workspace`.
 */
export function resolveCustomerDestination(
  input: CustomerDestinationInput,
): CustomerDestination {
  const {
    hasSession,
    isLoading = false,
    checkoutSessionId,
    nextParam,
    arrivedFromAuthCallback = false,
  } = input;

  if (isLoading) return { kind: 'pending', path: null };

  if (checkoutSessionId) return { kind: 'checkout-setup', path: WELCOME_PATH };

  if (arrivedFromAuthCallback) return { kind: 'onboarding', path: WELCOME_PATH };

  if (!hasSession) return { kind: 'onboarding', path: WELCOME_PATH };

  if (isSafeInternalPath(nextParam)) return { kind: 'next', path: nextParam };

  return { kind: 'workspace', path: CUSTOMER_HOME_PATH };
}

/**
 * Beschriftung, die zu diesem Ziel gehört.
 *
 * Freigabe des Eigentümers vom 2026-09-06 („go" auf die Fragepflicht nach
 * §10.3). Anlass: Seit der Einstieg für einen angemeldeten Kunden in den
 * Arbeitsbereich führt, hieß der Punkt weiterhin „Login" — er versprach eine
 * Anmeldung, die längst besteht, und verschwieg, wohin er tatsächlich führt.
 *
 * Beschriftung und Ziel stammen deshalb aus **derselben** Entscheidung. Zwei
 * getrennte Bedingungen wären genau die Stelle, an der beide wieder
 * auseinanderlaufen — und das Auseinanderlaufen sähe man niemandem an.
 */
export function customerEntryLabel(destination: CustomerDestination): string {
  return destination.kind === 'workspace' || destination.kind === 'next'
    ? WORKSPACE_LINK_LABEL
    : LOGIN_LINK_LABEL;
}

/**
 * Trägt die aktuelle Adresse die Rückkehr aus einem Auth-Callback?
 *
 * Der Unterschied ist für den Einstieg entscheidend und lässt sich später
 * nicht mehr feststellen: Ein Neukunde kommt vom Magic-Link auf `/welcome`
 * zurück und ist ab diesem Moment **angemeldet** — an der Sitzung allein ist
 * er von einem Bestandskunden nicht mehr zu unterscheiden. Wer ihn beim
 * Mounten in den Arbeitsbereich schickte, überspränge genau die Einrichtung,
 * für die er hergekommen ist.
 *
 * Die Artefakte in der Adresse sagen es. Sie müssen **synchron beim ersten
 * Rendern** gelesen werden: Der Supabase-Client räumt Hash bzw. Query auf,
 * sobald er die Sitzung übernommen hat.
 *
 * `implicit` (Vorgabe des Clients) liefert die Marker im Hash, `pkce` und
 * OAuth im Query — deshalb beide.
 */
export function hasAuthCallbackArtifacts(search: string, hash: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const marker = /(^|&)(access_token|refresh_token|provider_token|token_hash|code|error_code)=/;
  return marker.test(query) || marker.test(fragment);
}
