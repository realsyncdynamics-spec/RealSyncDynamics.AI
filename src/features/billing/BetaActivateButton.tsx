import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { BETA } from '../../config/beta';
import { postEdgeFunction } from '../../lib/edgeFunction';
import { useOptionalTenant } from '../../core/access/TenantProvider';
import { invalidateEntitlementsCache } from '../../core/billing/useEntitlements';
import type { BetaEnrollResponse } from './useBetaEnrollment';

/**
 * Beta-Zugang per Klick (WP-3) — für Flächen, die einen Plan-Gate zeigen,
 * bevor die App-Shell (`BetaAppBanner`) die Anmeldung nachholen konnte,
 * z. B. `/build`. Die Edge Function `beta-enroll` entscheidet selbst; hier
 * wird nur ausgelöst, der Entitlement-Cache geleert und neu geladen.
 *
 * Ohne aktive Beta rendert der Button nichts — der Gate bleibt dann der
 * reguläre Upgrade-Pfad.
 */
export function BetaActivateButton({
  source = 'beta',
  className = '',
  onEnrolled,
}: {
  source?: string;
  className?: string;
  /** Standard: Seite neu laden, damit alle Hooks den neuen Plan sehen. */
  onEnrolled?: () => void;
}) {
  const tenant = useOptionalTenant();
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'skipped'; reason: string } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  if (!BETA.active) return null;
  const tenantId = tenant?.activeTenantId ?? null;

  const activate = async () => {
    setState({ kind: 'busy' });
    try {
      const res = await postEdgeFunction<BetaEnrollResponse>('beta-enroll', { tenantId, source });
      if (res.enrolled) {
        invalidateEntitlementsCache();
        await tenant?.refresh();
        if (onEnrolled) onEnrolled();
        else window.location.reload();
        return;
      }
      setState({ kind: 'skipped', reason: res.reason ?? 'UNKNOWN' });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void activate()}
        disabled={state.kind === 'busy' || !tenantId}
        className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold uppercase tracking-wider disabled:opacity-60 ${className}`}
        data-testid="beta-activate-cta"
      >
        {state.kind === 'busy' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
        Beta-Zugang aktivieren
      </button>
      <p className="max-w-sm font-mono text-[10px] leading-relaxed text-titanium-500">
        {state.kind === 'skipped' &&
          (state.reason === 'STRIPE_SUBSCRIPTION' || state.reason === 'ACTIVE_SUBSCRIPTION'
            ? 'Ihr laufendes Abo bleibt unverändert — die Beta ersetzt es nicht.'
            : 'Die Beta-Freischaltung war für dieses Konto nicht möglich.')}
        {state.kind === 'error' && `Beta-Zugang konnte nicht eingerichtet werden: ${state.message}`}
        {state.kind === 'idle' &&
          `Kostenlos bis ${BETA.endsLabel} · voller ${BETA.testPlan === 'growth' ? 'Growth' : BETA.testPlan}-Umfang · keine Zahlungsdaten.`}
      </p>
    </div>
  );
}
