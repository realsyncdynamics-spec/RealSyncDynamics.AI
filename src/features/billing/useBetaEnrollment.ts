import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BETA } from '../../config/beta';
import { postEdgeFunction } from '../../lib/edgeFunction';
import { useOptionalTenant } from '../../core/access/TenantProvider';

/**
 * Beta-Zugang serverseitig vergeben (WP-3).
 *
 * Der Beta-Einstieg (`betaSignupHref`) führt über `/welcome` mit
 * `next=/app/dashboard?beta=1`. Welcome navigiert sofort nach dem Login —
 * oft bevor der Arbeitsbereich existiert. Deshalb merkt sich der Browser den
 * Wunsch (`PENDING_KEY`) und die App-Shell holt die Anmeldung nach, sobald
 * ein Mandant aktiv ist. Die Edge Function `beta-enroll` entscheidet selbst
 * (Mitgliedschaft, Rolle, kein Überschreiben laufender Abos); hier wird nur
 * ausgelöst und danach die Entitlements neu geladen.
 */
export const PENDING_KEY = 'rsd-beta-enroll-pending';

export interface BetaEnrollResponse {
  ok: true;
  enrolled: boolean;
  alreadyEnrolled?: boolean;
  reason?: 'STRIPE_SUBSCRIPTION' | 'ACTIVE_SUBSCRIPTION' | 'NEW_ENROLLMENT_CLOSED';
  planKey?: string;
  endsAt?: string;
}

export type BetaEnrollState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'enrolled'; endsAt: string | null; fresh: boolean }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string; retryable: boolean };

/** Fehler, nach denen ein späterer Versuch sinnvoll ist (Arbeitsbereich fehlt noch). */
export function isRetryableEnrollError(message: string): boolean {
  return /No tenant found|Multiple tenants|nicht erreichbar|HTTP 5\d\d/i.test(message);
}

function readPending(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

function writePending(on: boolean): void {
  try {
    if (on) localStorage.setItem(PENDING_KEY, '1');
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* Privatmodus: dann nur für diesen Seitenaufruf */
  }
}

export function useBetaEnrollment(): BetaEnrollState {
  const location = useLocation();
  const tenant = useOptionalTenant();
  const [state, setState] = useState<BetaEnrollState>({ status: 'idle' });
  const started = useRef(false);

  const fromLink = new URLSearchParams(location.search).get('beta') === '1';
  if (fromLink && BETA.active) writePending(true);

  const tenantId = tenant?.activeTenantId ?? null;
  const ready = Boolean(tenant && !tenant.loading && tenantId);

  useEffect(() => {
    if (!BETA.active || started.current || !ready) return;
    if (!fromLink && !readPending()) return;
    started.current = true;
    setState({ status: 'pending' });

    const source = new URLSearchParams(location.search).get('source') ?? undefined;
    postEdgeFunction<BetaEnrollResponse>('beta-enroll', { tenantId, source })
      .then((res) => {
        writePending(false);
        if (res.enrolled) {
          setState({ status: 'enrolled', endsAt: res.endsAt ?? null, fresh: !res.alreadyEnrolled });
          if (!res.alreadyEnrolled) void tenant?.refresh();
        } else {
          setState({ status: 'skipped', reason: res.reason ?? 'UNKNOWN' });
        }
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        const retryable = isRetryableEnrollError(message);
        if (!retryable) writePending(false);
        setState({ status: 'error', message, retryable });
      });
    // `started` verhindert eine zweite Anmeldung, wenn sich Abhängigkeiten ändern.
  }, [ready, tenantId, fromLink, location.search, tenant]);

  return state;
}
