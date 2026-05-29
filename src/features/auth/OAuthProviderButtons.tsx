import { useState, type ReactNode } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * OAuthProviderButtons — wiederverwendbare Auth-Provider-Buttons fuer
 * Welcome.tsx und CheckoutPage.tsx.
 *
 * Provider-Set in dieser PR (User-Wahl):
 *   - Google      (Workspace + Gmail — primaer fuer DACH-Compliance-Personae)
 *   - LinkedIn    (DSB / Compliance-Officer Sales-Pfad)
 *   - GitHub      (Engineering-Audience)
 *
 * Bewusst NICHT enthalten:
 *   - Facebook    (Trust-Konflikt mit DSGVO-Brand — Meta-Login auf einer
 *                  Datenschutz-Plattform widerspricht der Position)
 *   - Microsoft   (kommt mit Enterprise-Tier-Outreach in Folge-PR)
 *
 * Magic-Link bleibt als Fallback in Welcome.tsx erhalten — diese Component
 * ergaenzt es, ersetzt es nicht.
 *
 * Provider-Sichtbarkeit ist per env-Flag steuerbar (Default: an). Setze
 * VITE_AUTH_<PROVIDER>_ENABLED=false im Hosting-Dashboard, um einen
 * defekten Provider auszublenden, ohne Deploy auszuloesen. Beispiel:
 * VITE_AUTH_GOOGLE_ENABLED=false blendet den Google-Button aus, wenn
 * die OAuth-Client-ID in der Google Cloud Console ungueltig ist.
 */

type Provider = 'google' | 'azure' | 'linkedin_oidc' | 'github';

// "true" ist Default — nur explizites "false" deaktiviert. Damit kann ein
// neu deployter Stack ohne env-Var weiterhin alle Provider zeigen.
function flagOn(value: string | undefined): boolean {
  return value !== 'false';
}

const PROVIDER_ENABLED: Record<Provider, boolean> = {
  google:        flagOn(import.meta.env.VITE_AUTH_GOOGLE_ENABLED),
  azure:         flagOn(import.meta.env.VITE_AUTH_AZURE_ENABLED),
  linkedin_oidc: flagOn(import.meta.env.VITE_AUTH_LINKEDIN_ENABLED),
  github:        flagOn(import.meta.env.VITE_AUTH_GITHUB_ENABLED),
};

interface ProviderConfig {
  id: Provider;
  label: string;
  description: string;
  /** Inline-SVG-Icon, brand-coded (offizielle Farben, ohne Tailwind-Class). */
  icon: ReactNode;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'google',
    label: 'Mit Google fortfahren',
    description: 'Workspace + Gmail',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.547 0 9c0 1.453.348 2.827.957 4.042l3.007-2.332z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        />
      </svg>
    ),
  },
  {
    id: 'azure',
    label: 'Mit Microsoft fortfahren',
    description: 'Microsoft 365 · Azure AD · Entra ID',
    icon: (
      <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
      </svg>
    ),
  },
  {
    id: 'linkedin_oidc',
    label: 'Mit LinkedIn fortfahren',
    description: 'Sales / Compliance-Officer',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <path
          fill="#fff"
          d="M7 9.5h-3v9h3v-9zm-1.5-1.2c.94 0 1.7-.76 1.7-1.7s-.76-1.7-1.7-1.7c-.94 0-1.7.76-1.7 1.7s.76 1.7 1.7 1.7zm14.5 1.2h-2.86v1.23h-.04c-.4-.76-1.38-1.55-2.83-1.55-3.03 0-3.59 1.99-3.59 4.58v4.74h2.99v-4.2c0-1 .02-2.29 1.39-2.29 1.39 0 1.6 1.09 1.6 2.21v4.28h2.99v-4.91c0-2.6-.56-4.59-3.65-4.59z"
        />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'Mit GitHub fortfahren',
    description: 'Engineering-Teams',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#fff"
          d="M12 .297a12 12 0 00-3.79 23.4c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61a3.18 3.18 0 00-1.34-1.76c-1.09-.74.08-.73.08-.73a2.52 2.52 0 011.84 1.24 2.56 2.56 0 003.5 1 2.55 2.55 0 01.76-1.6c-2.66-.3-5.47-1.33-5.47-5.93a4.64 4.64 0 011.24-3.22 4.32 4.32 0 01.12-3.18s1-.32 3.3 1.23a11.36 11.36 0 016 0c2.3-1.55 3.3-1.23 3.3-1.23a4.32 4.32 0 01.12 3.18 4.63 4.63 0 011.24 3.22c0 4.61-2.81 5.62-5.49 5.92a2.86 2.86 0 01.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0012 .297"
        />
      </svg>
    ),
  },
];

export interface OAuthProviderButtonsProps {
  /** Pfad nach erfolgreicher Auth (z.B. /checkout/starter). Wird als
   *  ?next= an redirectTo angehaengt. Default: window.location.pathname. */
  redirectAfterAuthTo?: string;
  /** Optional: Variant fuer Container — 'compact' fuer Modals, 'full' fuer Pages. */
  variant?: 'compact' | 'full';
}

// Maps Supabase-Auth-Fehler auf eine UI-Meldung. Der haeufigste produktive
// Fall ist `validation_failed` mit msg "provider is not enabled" — der
// Provider-String stimmt, aber der Provider ist im Supabase-Dashboard
// (Auth → Providers) nicht aktiviert. Wir zeigen das explizit pro Provider,
// damit der User sofort einen anderen Anbieter waehlt, und merken uns den
// Button als deaktiviert (sonst landen wir in einer Retry-Schleife auf
// demselben Fehler).
function classifyOAuthError(
  err: unknown,
): { kind: 'provider_disabled' | 'other'; userMessage: string; rawCode?: string } {
  const e = err as { message?: string; code?: string; status?: number } | null;
  const msg = (e?.message ?? '').toLowerCase();
  const code = e?.code ?? '';
  if (code === 'validation_failed' || msg.includes('provider is not enabled')) {
    return {
      kind: 'provider_disabled',
      userMessage:
        'Dieser Login ist gerade nicht verfuegbar. Bitte waehle einen anderen Anbieter oder den Magic-Link weiter unten.',
      rawCode: 'validation_failed',
    };
  }
  return {
    kind: 'other',
    userMessage: e?.message ?? 'OAuth-Login konnte nicht gestartet werden.',
    rawCode: code || undefined,
  };
}

export function OAuthProviderButtons({
  redirectAfterAuthTo,
  variant = 'full',
}: OAuthProviderButtonsProps) {
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disabledProviders, setDisabledProviders] = useState<Set<Provider>>(
    () => new Set(),
  );
  const [lastErrorProvider, setLastErrorProvider] = useState<Provider | null>(null);

  const handleProviderClick = async (provider: Provider) => {
    if (!isSupabaseConfigured()) {
      setError('Auth ist nicht konfiguriert (VITE_SUPABASE_URL fehlt).');
      return;
    }
    setBusyProvider(provider);
    setError(null);
    setLastErrorProvider(null);
    try {
      const sb = getSupabase();
      // redirectTo: zurueck auf die Seite die den Login getriggert hat
      // — wenn redirectAfterAuthTo gesetzt, hat es Vorrang, sonst aktuelle URL.
      const target =
        redirectAfterAuthTo && redirectAfterAuthTo.startsWith('/')
          ? `${window.location.origin}${redirectAfterAuthTo}`
          : window.location.href;

      const { error: oauthErr } = await sb.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: target,
        },
      });
      if (oauthErr) throw oauthErr;
      // Browser navigiert nach Provider-Login — kein weiterer Code laeuft hier.
    } catch (err) {
      const cls = classifyOAuthError(err);
      // Telemetry: macht im Browser-Devtools + Sentry sofort sichtbar,
      // welcher Provider-Button welchen Fehler-Code geworfen hat.
      console.error('[oauth] signInWithOAuth failed', {
        provider,
        code: cls.rawCode,
        raw: err,
      });
      setError(cls.userMessage);
      setLastErrorProvider(provider);
      if (cls.kind === 'provider_disabled') {
        setDisabledProviders((prev) => {
          const next = new Set(prev);
          next.add(provider);
          return next;
        });
      }
      setBusyProvider(null);
    }
  };

  const isCompact = variant === 'compact';
  const visibleProviders = PROVIDERS.filter((p) => PROVIDER_ENABLED[p.id]);

  // Wenn alle Provider per Flag aus sind, rendern wir nichts statt einer
  // leeren Box — die aufrufenden Seiten haben weiterhin Magic-Link als
  // Fallback. Kein Layout-Sprung, keine Verwirrung.
  if (visibleProviders.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleProviders.map((p) => {
        const isThisBusy = busyProvider === p.id;
        const isAnyBusy = busyProvider !== null;
        const isDisabled = disabledProviders.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            disabled={isAnyBusy || isDisabled}
            onClick={() => handleProviderClick(p.id)}
            data-provider={p.id}
            data-oauth-error={
              lastErrorProvider === p.id ? 'validation_failed' : undefined
            }
            aria-label={
              isDisabled ? `${p.label} (aktuell nicht verfuegbar)` : p.label
            }
            className={`w-full inline-flex items-center justify-center gap-3 px-4 ${
              isCompact ? 'py-2' : 'py-2.5'
            } bg-obsidian-900/80 hover:bg-obsidian-800 border border-silver-700/40 hover:border-silver-500 rounded-none transition-colors text-titanium-100 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isThisBusy ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <span className="shrink-0">{p.icon}</span>
            )}
            <span className="flex-1 text-left">
              <span className="block text-sm font-semibold">
                {p.label}
                {isDisabled && (
                  <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-silver-500">
                    nicht verfuegbar
                  </span>
                )}
              </span>
              {!isCompact && (
                <span className="block text-[11px] font-mono uppercase tracking-wider text-silver-500">
                  {p.description}
                </span>
              )}
            </span>
          </button>
        );
      })}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 text-xs text-red-300 bg-red-950/30 border border-red-900/40 rounded-none p-2.5"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
