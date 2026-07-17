import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2, AlertCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { tierById, type TierId } from '../../config/pricing';
import { createCheckoutSession, type PlanKey } from './checkout';
import { classifyStripeError, getStripeDiagnostic, type StripeDiagnostic } from './stripeDiagnostics';
import { OAuthProviderButtons } from '../auth/OAuthProviderButtons';
import { trackMarketingEvent } from '../../lib/marketingAnalytics';
import { trackConversion } from '../../lib/pixels';

/**
 * /checkout/:planKey — Real-Stripe-Checkout-Bridge.
 *
 * Flow:
 *   1. Tier aus URL-Param laden (free / starter / growth / agency / enterprise)
 *   2. Auth-State prüfen via Supabase
 *   3a. Wenn nicht eingeloggt: Link auf /welcome mit ?next=/checkout/:planKey
 *   3b. Wenn eingeloggt + Tenant vorhanden: createCheckoutSession() rufen,
 *       window.location.href = data.url (Stripe-Hosted-Checkout)
 *   3c. Wenn eingeloggt aber kein Tenant: Link auf /welcome zur Tenant-Erstellung
 *
 * Free: hier nicht angezeigt — wird vor dem Routing umgeleitet (free -> /audit).
 */

const VALID_PLAN_KEYS = new Set<PlanKey>([
  'free-audit', 'starter', 'growth', 'agency', 'scale', 'enterprise',
  'starter_yearly', 'growth_yearly', 'agency_yearly', 'scale_yearly',
]);
// DE enterprise checkout – feature/de-enterprise-frontend-checkout
type AuthState =
  | { status: 'loading' }
  | { status: 'no_user' }
  | { status: 'no_tenant'; userEmail: string }
  | { status: 'ready'; userEmail: string; tenantId: string };

export function CheckoutPage() {
  const { planKey } = useParams<{ planKey: string }>();
  const [searchParams] = useSearchParams();
  const isPilot = searchParams.get('pilot') === 'true';
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [checkoutErr, setCheckoutErr] = useState<StripeDiagnostic | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // §312k / §356(5) BGB: explicit consent gate. Required for paid recurring
  // SaaS so the §356(5) BGB withdrawal-right-erasure is documentably
  // acknowledged BEFORE we hand off to Stripe-Hosted-Checkout. See
  // /legal/terms §12. Both must be checked to enable submit.
  const [agreedToTerms,    setAgreedToTerms]    = useState(false);
  const [acknowledgedWithdrawal, setAcknowledgedWithdrawal] = useState(false);

  // 1. Validate planKey
  const validPlan = planKey && VALID_PLAN_KEYS.has(planKey as PlanKey)
    ? (planKey as PlanKey)
    : null;
  const tier = validPlan ? tierById(validPlan as TierId) : undefined;

  // 2. Free + Enterprise + Invalid: redirect away — diese Page nicht zustaendig
  useEffect(() => {
    // 'free_audit' (Underscore) ist der externe Marketing-Identifier für
    // denselben Free-Plan — alle Varianten führen zum kostenlosen Audit.
    if (planKey === 'free' || planKey === 'free-audit' || planKey === 'free_audit') {
      window.location.href = '/audit?source=checkout-free-redirect';
      return;
    }
    if (planKey === 'enterprise') {
      window.location.href = '/contact-sales?intent=enterprise&source=checkout-redirect';
      return;
    }
    // Invalid plan key: redirect to pricing (full page load for E2E test compatibility)
    if (planKey && !VALID_PLAN_KEYS.has(planKey as PlanKey)) {
      window.location.href = '/pricing';
      return;
    }
  }, [planKey]);

  // 3. Auth-State + Membership-Lookup
  useEffect(() => {
    if (!validPlan) return;
    let cancelled = false;

    // Sicherheitsnetz gegen unbegrenzten „Lade…"-Zustand: Falls die
    // Auth-Auflösung (z. B. eine hängende Membership-Abfrage oder Client-
    // Initialisierung) nicht zeitnah zurückkommt, fällt die Seite in den
    // Login-Zustand zurück — recoverbar per Klick statt endloser Spinner.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setAuth((prev) => (prev.status === 'loading' ? { status: 'no_user' } : prev));
      }
    }, 8000);

    (async () => {
      const sb = getSupabase();
      // getSession() liest die Session lokal aus dem Storage und ist damit
      // praktisch sofort verfügbar. Das vorherige getUser() machte einen
      // Netzwerk-Roundtrip zum Auth-Server (/auth/v1/user), der beim ersten
      // Aufruf mehrere Sekunden hängen konnte („Lade…", erst nach Reload ok).
      // Die eigentliche Autorisierung passiert ohnehin serverseitig in
      // createCheckoutSession() (Edge Function + RLS auf memberships).
      const { data: sessionData } = await sb.auth.getSession();
      if (cancelled) return;
      const user = sessionData?.session?.user;
      if (!user) {
        clearTimeout(timeout);
        setAuth({ status: 'no_user' });
        return;
      }
      const userEmail = user.email ?? '';
      const { data: memberships } = await sb
        .from('memberships')
        .select('tenant_id, role')
        .in('role', ['owner', 'admin'])
        .limit(1);
      if (cancelled) return;
      clearTimeout(timeout);
      const firstTenant = memberships?.[0];
      if (!firstTenant?.tenant_id) {
        setAuth({ status: 'no_tenant', userEmail });
        return;
      }
      setAuth({ status: 'ready', userEmail, tenantId: firstTenant.tenant_id });
    })();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [validPlan]);

  // 4. Manual trigger on user submit — see consent gate render below.
  // Both BGB checkboxes are required before this fires.
  async function handleConfirmAndPay() {
    if (auth.status !== 'ready' || !validPlan || redirecting) return;
    if (!agreedToTerms || !acknowledgedWithdrawal) return;
    setRedirecting(true);
    setCheckoutErr(null);
    trackMarketingEvent('checkout_started', { plan_key: validPlan });
    trackConversion('InitiateCheckout', {
      content_name: validPlan,
      value: tier?.priceEur ?? 0,
      currency: 'EUR',
    });
    const result = await createCheckoutSession(auth.tenantId, validPlan, isPilot);
    if (result.ok && result.url) {
      window.location.href = result.url;
    } else {
      const status = classifyStripeError(result.error);
      setCheckoutErr(getStripeDiagnostic(status));
      setRedirecting(false);
    }
  }

  // ─── Render-Cases ──────────────────────────────────────────────────────────

  if (!validPlan || !tier) {
    return (
      <ShellWithMessage
        title="Unbekanntes Paket"
        body={`"${planKey}" ist kein bekannter Plan. Verfuegbar: starter / growth / agency / scale (monatlich oder jährlich).`}
        cta={{ label: 'Zur Preisuebersicht', to: '/pricing' }}
        backTo="/pricing"
      />
    );
  }

  if (auth.status === 'loading') {
    return (
      <ShellWithMessage
        title="Pruefe Anmelde-Status..."
        body="Einen Moment."
        loading
        backTo={`/pricing/${validPlan}`}
      />
    );
  }

  if (auth.status === 'no_user') {
    const checkoutPath = `/checkout/${validPlan}`;
    return (
      <NoUserShell
        title={`Anmelden, um ${tier.name} zu buchen`}
        body="Wählen Sie einen Login-Weg. Nach Anmeldung sind Sie sofort wieder hier — der Checkout startet automatisch."
        oauthRedirect={checkoutPath}
        magicLinkHref={`/welcome?next=${encodeURIComponent(checkoutPath)}`}
        backTo={`/pricing/${validPlan}`}
      />
    );
  }

  if (auth.status === 'no_tenant') {
    return (
      <ShellWithMessage
        title="Workspace einrichten"
        body={`Eingeloggt als ${auth.userEmail}, aber noch kein Workspace vorhanden. Im naechsten Schritt richten wir Ihren Tenant ein, dann koennen Sie ${tier.name} buchen.`}
        cta={{
          label: 'Workspace einrichten',
          to: `/welcome?next=${encodeURIComponent(`/checkout/${validPlan}`)}`,
        }}
        backTo={`/pricing/${validPlan}`}
      />
    );
  }

  // status === 'ready' — manual consent gate before Stripe hand-off.
  return (
    <ConsentGateShell
      planKey={validPlan}
      tier={tier}
      userEmail={auth.userEmail}
      isPilot={isPilot}
      agreedToTerms={agreedToTerms}
      onAgreedToTerms={setAgreedToTerms}
      acknowledgedWithdrawal={acknowledgedWithdrawal}
      onAcknowledgedWithdrawal={setAcknowledgedWithdrawal}
      redirecting={redirecting}
      checkoutErr={checkoutErr}
      onConfirm={handleConfirmAndPay}
      backTo={`/pricing/${validPlan}`}
    />
  );
}

// ─── Shared Shell ──────────────────────────────────────────────────────────

function ShellWithMessage({
  title,
  body,
  cta,
  loading,
  footer,
  backTo = '/pricing',
}: {
  title: string;
  body: string;
  cta?: { label: string; to: string };
  loading?: boolean;
  footer?: string;
  backTo?: string;
}) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="px-4 sm:px-6 lg:px-8 py-4 border-b border-silver-700/30 flex items-center justify-between">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50"
          data-testid="checkout-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-display font-bold">RealSyncDynamics.AI</span>
        </Link>
        <Link to="/legal/privacy" className="text-xs text-silver-500 hover:text-titanium-200">
          Datenschutz
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="max-w-md w-full text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-gold-400 mb-5" />
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight mb-3">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-silver-300 leading-relaxed mb-6">
            {body}
          </p>

          {loading && (
            <div className="inline-flex items-center gap-2 text-silver-400 text-sm mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Bitte warten…</span>
            </div>
          )}

          {cta && !loading && (
            <Link
              to={cta.to}
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
            >
              {cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {footer && (
            <div className="mt-8 text-[11px] font-mono uppercase tracking-wider text-silver-500">
              {footer}
            </div>
          )}

          <div className="mt-6 inline-flex items-center gap-1.5 text-xs text-silver-500">
            <AlertCircle className="h-3 w-3" />
            <span>Stripe-Hosted-Checkout · Monatlich kündbar · Keine Setup-Gebühren</span>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── NoUserShell — Login-Optionen mit OAuth + Magic-Link-Fallback ──────────

function NoUserShell({
  title,
  body,
  oauthRedirect,
  magicLinkHref,
  backTo = '/pricing',
}: {
  title: string;
  body: string;
  oauthRedirect: string;
  magicLinkHref: string;
  backTo?: string;
}) {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100" data-testid="checkout-auth-required">
      <header className="px-4 sm:px-6 lg:px-8 py-4 border-b border-silver-700/30 flex items-center justify-between">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50"
          data-testid="checkout-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-display font-bold">RealSyncDynamics.AI</span>
        </Link>
        <Link to="/legal/privacy" className="text-xs text-silver-500 hover:text-titanium-200">
          Datenschutz
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <ShieldCheck className="mx-auto h-10 w-10 text-gold-400 mb-4" />
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight mb-3">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-silver-300 leading-relaxed">{body}</p>
          </div>

          <OAuthProviderButtons redirectAfterAuthTo={oauthRedirect} />

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-silver-700/40" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-silver-500">
              oder
            </span>
            <div className="flex-1 h-px bg-silver-700/40" />
          </div>

          <Link
            to={magicLinkHref}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
          >
            Mit Magic-Link (Email) anmelden
          </Link>

          <div className="mt-6 inline-flex items-center gap-1.5 text-xs text-silver-500 w-full justify-center">
            <AlertCircle className="h-3 w-3" />
            <span>OAuth · Magic-Link · Stripe-Hosted-Checkout</span>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Consent Gate (§312k + §356(5) BGB) ────────────────────────────────────
//
// Final step before handing off to Stripe-Hosted-Checkout. The user must
// explicitly tick both boxes:
//
//   1. AGB + Datenschutz acknowledgment    → standard transparency
//   2. §356(5) BGB withdrawal-right erasure → digital-content waiver so
//      service can be provisioned immediately at payment, before the
//      14-day Widerrufsfrist would elapse. Documented in /legal/terms §12.
//
// Both ticks are recorded in marketing analytics so we have a timestamped
// trail of consent — separate from the Stripe session itself.

function ConsentGateShell({
  planKey,
  tier,
  userEmail,
  isPilot,
  agreedToTerms,
  onAgreedToTerms,
  acknowledgedWithdrawal,
  onAcknowledgedWithdrawal,
  redirecting,
  checkoutErr,
  onConfirm,
  backTo = '/pricing',
}: {
  planKey:                  string;
  tier:                     { name: string; priceEur: number };
  userEmail:                string;
  isPilot:                  boolean;
  agreedToTerms:            boolean;
  onAgreedToTerms:          (value: boolean) => void;
  acknowledgedWithdrawal:   boolean;
  onAcknowledgedWithdrawal: (value: boolean) => void;
  redirecting:              boolean;
  checkoutErr:              StripeDiagnostic | null;
  onConfirm:                () => void;
  backTo?:                  string;
}) {
  const canSubmit = agreedToTerms && acknowledgedWithdrawal && !redirecting;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="px-4 sm:px-6 lg:px-8 py-4 border-b border-silver-700/30 flex items-center justify-between">
        <Link
          to="/pricing"
          data-testid="checkout-back"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-display font-bold">RealSyncDynamics.AI</span>
        </Link>
        <Link to="/legal/privacy" className="text-xs text-silver-500 hover:text-titanium-200">
          Datenschutz
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="max-w-md w-full" data-testid={`checkout-plan-${planKey}`}>
          <ShieldCheck className="mx-auto h-10 w-10 text-gold-400 mb-5" />
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight mb-2 text-center">
            {tier.name}
          </h1>
          <p className="text-center text-silver-300 text-sm sm:text-base mb-1">
            <span>{tier.priceEur} €</span> / Monat · monatlich kündbar · keine Setup-Gebühren
          </p>
          {isPilot && (
            <div className="mb-6 p-4 bg-emerald-950 border-2 border-emerald-600 rounded-sm text-center">
              <p className="font-mono font-bold text-base uppercase tracking-wider text-emerald-300 mb-1">
                ✅ 14 TAGE KOSTENLOS
              </p>
              <p className="font-mono text-xs text-emerald-200">
                Keine Zahlung erforderlich. Abo startet automatisch nach der Testphase.
              </p>
            </div>
          )}
          {!isPilot && (
            <p className="text-center font-mono text-[10px] uppercase tracking-wider text-silver-500 mb-6">
              Erste Abbuchung sofort nach Bestellung
            </p>
          )}

          <div className="space-y-3 mb-5">
            <label className="flex items-start gap-3 p-3 border border-silver-700/50 hover:border-silver-500 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => onAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-gold-400"
                aria-describedby="agb-consent-text"
              />
              <span id="agb-consent-text" className="text-xs sm:text-sm text-silver-200 leading-relaxed">
                Ich habe die{' '}
                <Link to="/legal/terms" className="text-gold-300 underline hover:text-gold-200" target="_blank" rel="noopener noreferrer">
                  AGB
                </Link>{' '}
                und die{' '}
                <Link to="/legal/privacy" className="text-gold-300 underline hover:text-gold-200" target="_blank" rel="noopener noreferrer">
                  Datenschutzerklärung
                </Link>{' '}
                gelesen und akzeptiere sie.
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 border border-silver-700/50 hover:border-silver-500 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={acknowledgedWithdrawal}
                onChange={(e) => onAcknowledgedWithdrawal(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-gold-400"
                aria-describedby="withdrawal-consent-text"
              />
              <span id="withdrawal-consent-text" className="text-xs sm:text-sm text-silver-200 leading-relaxed">
                Ich willige ausdrücklich ein, dass mit der Bereitstellung des Dienstes vor Ablauf der
                14-tägigen Widerrufsfrist begonnen wird, und bestätige, dass mein Widerrufsrecht
                mit Beginn der Vertragsausführung erlischt
                (§§ 356 Abs. 5, 327 BGB; siehe{' '}
                <Link to="/legal/terms" className="text-gold-300 underline hover:text-gold-200" target="_blank" rel="noopener noreferrer">
                  AGB § 12
                </Link>{' '}
                und{' '}
                <Link to="/legal/widerruf" className="text-gold-300 underline hover:text-gold-200" target="_blank" rel="noopener noreferrer">
                  Widerrufsbelehrung
                </Link>
                ).
              </span>
            </label>
          </div>

          {checkoutErr && (
            <div className="mb-4 p-3 border border-red-900 bg-red-950/30 text-xs text-red-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-red-100">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {checkoutErr.title}
              </div>
              <p className="leading-relaxed">{checkoutErr.message}</p>
              <p className="text-red-300"><span className="font-semibold">Nächster Schritt:</span> {checkoutErr.action}</p>
            </div>
          )}

          <div className="mb-6 space-y-4">
            <div className="text-center">
              <h3 className="font-semibold text-sm text-titanium-100 mb-2">Was ist alles enthalten</h3>
              <div className="space-y-1 text-xs text-silver-300">
                <div data-testid="checkout-feature-1">✓ Vollständiger Plattformzugriff</div>
                <div data-testid="checkout-feature-2">✓ Kundensupport</div>
                <div data-testid="checkout-feature-3">✓ Regelmäßige Updates</div>
              </div>
            </div>
          </div>

          <div className="mb-6 border-t border-silver-700/50 pt-4">
            <h3 className="font-semibold text-sm text-titanium-100 mb-3 text-center">Häufige Fragen</h3>
            <div className="space-y-2 text-xs text-silver-300">
              <details className="hover:text-silver-200 cursor-pointer">
                <summary className="font-medium">Kann ich jederzeit kündigen?</summary>
                <p className="mt-1 ml-2">Ja, monatlich kündbar ohne Bindung oder Kündigungsfrist.</p>
              </details>
              <details className="hover:text-silver-200 cursor-pointer">
                <summary className="font-medium">Welche Zahlungsarten akzeptiert ihr?</summary>
                <p className="mt-1 ml-2">Stripe akzeptiert alle gängigen Kreditkarten und Zahlungsmethoden.</p>
              </details>
            </div>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canSubmit}
            data-testid="checkout-book-button"
            className={`surface-gold w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-none transition-opacity ${
              canSubmit ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed'
            }`}
          >
            {redirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Stripe wird geöffnet…
              </>
            ) : (
              <>
                Jetzt zahlungspflichtig bestellen <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="mt-4 text-[11px] font-mono uppercase tracking-wider text-silver-500 text-center">
            Angemeldet als {userEmail}
          </div>
          <div className="mt-3 text-center">
            <Link to="/legal/avv" className="text-[11px] text-gold-300 hover:text-gold-200 underline" target="_blank" rel="noopener noreferrer">
              AVV (Auftragsverarbeitungsvertrag) einsehen
            </Link>
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-silver-500 w-full justify-center">
            <AlertCircle className="h-3 w-3" />
            <span>Stripe-Hosted-Checkout · Monatlich kündbar · Keine Setup-Gebühren</span>
          </div>
        </div>
      </main>
    </div>
  );
}
