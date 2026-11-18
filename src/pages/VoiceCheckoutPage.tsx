import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { CapabilityAvailabilityNotice } from '../components/landing/CapabilityAvailabilityNotice';
import { getSupabase } from '../lib/supabase';
import {
  formatPriceEur,
  PRICING_TAX_MODE,
  pricingTaxNote,
  standaloneVoiceOfferById,
} from '@/shared/pricing';
import { createVoiceAgentCheckoutSession } from '../features/billing/checkout';
import { canOfferVoiceCheckout } from '../config/voice-checkout';

/**
 * /voice/checkout/:offerId — Kauf des eigenständigen Voice-Agent-Abos.
 *
 * Preise und Leistungsumfang nur aus VOICE_STANDALONE_OFFERS (shared/pricing.ts).
 * Der Knopf erscheint nur, wenn Anzeige-Schalter, Deploy und Angebotsfreigabe
 * zusammenpassen (canOfferVoiceCheckout); der Server prüft alles erneut.
 * Zustimmung zu AGB und zum vorzeitigen Erlöschen des Widerrufsrechts
 * (§ 356 Abs. 5 BGB) vor der Übergabe an Stripe, wie in /checkout/:planKey.
 */

const WAITLIST_URL = '/warteliste?interest=bots&utm_source=voice-checkout&utm_medium=product-page&utm_campaign=voice-agent-preview';

const ERROR_TEXT: Record<string, string> = {
  CHECKOUT_DISABLED: 'Der Kauf ist noch nicht freigeschaltet.',
  OFFER_NOT_RELEASED: 'Der Leistungsumfang dieses Pakets ist noch nicht bestätigt.',
  ALREADY_SUBSCRIBED: 'Für Ihr Unternehmen läuft bereits ein Voice-Agent-Abo.',
  FORBIDDEN: 'Nur Inhaber oder Administratoren können ein Abo abschließen.',
  PRICE_MISMATCH: 'Der Preis wird gerade abgeglichen. Bitte versuchen Sie es später erneut.',
  PRICE_NOT_CONFIGURED: 'Der Kauf ist noch nicht freigeschaltet.',
};

type AuthState =
  | { status: 'loading' }
  | { status: 'no_user' }
  | { status: 'no_tenant' }
  | { status: 'ready'; tenantId: string };

export function VoiceCheckoutPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const [searchParams] = useSearchParams();
  const outcome = searchParams.get('checkout');
  const offer = standaloneVoiceOfferById(offerId);
  const available = offer ? canOfferVoiceCheckout(offer) : false;

  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [acknowledgedWithdrawal, setAcknowledgedWithdrawal] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available || outcome) return;
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const { data: sessionData } = await sb.auth.getSession();
      if (cancelled) return;
      if (!sessionData?.session?.user) {
        setAuth({ status: 'no_user' });
        return;
      }
      const { data: memberships } = await sb
        .from('memberships')
        .select('tenant_id, role')
        .in('role', ['owner', 'admin'])
        .limit(1);
      if (cancelled) return;
      const tenantId = memberships?.[0]?.tenant_id;
      setAuth(tenantId ? { status: 'ready', tenantId } : { status: 'no_tenant' });
    })();
    return () => { cancelled = true; };
  }, [available, outcome]);

  async function handleSubscribe() {
    if (auth.status !== 'ready' || !offer || redirecting) return;
    if (!agreedToTerms || !acknowledgedWithdrawal) return;
    setRedirecting(true);
    setError(null);
    const result = await createVoiceAgentCheckoutSession({ tenantId: auth.tenantId, offerId: offer.id });
    if (result.ok && result.url) {
      window.location.href = result.url;
      return;
    }
    setError(ERROR_TEXT[result.error?.code ?? ''] ?? 'Der Checkout konnte nicht gestartet werden. Bitte später erneut versuchen.');
    setRedirecting(false);
  }

  const checkoutPath = `/voice/checkout/${offerId ?? ''}`;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SEOHead title="Voice Agent abonnieren" noIndex />
      <main className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
        <Link to="/phonebot/start" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-teal-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Zum Voice Agent
        </Link>

        {!offer ? (
          <section className="mt-10" data-testid="voice-checkout-unknown">
            <h1 className="text-3xl font-semibold tracking-tight">Unbekanntes Paket</h1>
            <p className="mt-4 text-slate-600">Dieses Voice-Agent-Paket gibt es nicht.</p>
          </section>
        ) : (
          <section className="mt-10" aria-labelledby="voice-checkout-h">
            <CapabilityAvailabilityNotice capabilityId="bots" className="mb-8 text-left" />
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Voice Agent · Monatsabo</p>
            <h1 id="voice-checkout-h" className="mt-3 text-3xl font-semibold tracking-tight">{offer.name}</h1>
            <p className="mt-4 text-3xl font-bold tracking-tight">
              {formatPriceEur(offer.monthlyEur)}
              <span className="text-sm font-normal text-slate-500"> / Monat</span>
            </p>
            <p className="mt-2 text-sm text-slate-500" data-testid="voice-checkout-tax-note">{pricingTaxNote(PRICING_TAX_MODE)}</p>
            {offer.bullets.length > 0 ? (
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                {offer.bullets.map((b) => <li key={b}>· {b}</li>)}
              </ul>
            ) : null}

            {outcome === 'success' ? (
              <div className="mt-8 border border-teal-200 bg-teal-50 p-5 text-sm text-teal-900" role="status" data-testid="voice-checkout-success">
                Vielen Dank. Ihr Abo ist bei Stripe eingegangen. Die Einrichtung Ihres Voice Agents startet,
                sobald die Zahlung bestätigt ist. Den Stand sehen Sie unter{' '}
                <Link to="/app/voice" className="font-semibold underline">Voice im Dashboard</Link>.
              </div>
            ) : outcome === 'cancelled' ? (
              <div className="mt-8 border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700" role="status" data-testid="voice-checkout-cancelled">
                Der Kauf wurde abgebrochen. Es wurde nichts berechnet.{' '}
                <Link to={checkoutPath} className="font-semibold underline">Erneut versuchen</Link>
              </div>
            ) : !available ? (
              <div className="mt-8 border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900" role="note" data-testid="voice-checkout-unavailable">
                Der Kauf dieses Pakets ist noch nicht freigeschaltet. Es wird hier kein Abo abgeschlossen.{' '}
                <Link to={WAITLIST_URL} className="font-semibold underline">Verfügbarkeit vormerken</Link>
              </div>
            ) : auth.status === 'loading' ? (
              <p className="mt-8 inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Anmeldung wird geprüft …
              </p>
            ) : auth.status === 'no_user' ? (
              <p className="mt-8 text-sm text-slate-700">
                Bitte melden Sie sich zuerst an.{' '}
                <Link to={`/welcome?next=${encodeURIComponent(checkoutPath)}`} className="font-semibold text-teal-800 underline">Anmelden</Link>
              </p>
            ) : auth.status === 'no_tenant' ? (
              <p className="mt-8 text-sm text-slate-700">
                Für den Kauf brauchen Sie ein Unternehmenskonto, in dem Sie Inhaber oder Administrator sind.{' '}
                <Link to={`/welcome?next=${encodeURIComponent(checkoutPath)}`} className="font-semibold text-teal-800 underline">Konto einrichten</Link>
              </p>
            ) : (
              <div className="mt-8 space-y-3" data-testid="voice-checkout-form">
                <label className="flex cursor-pointer items-start gap-3 border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                    aria-describedby="voice-agb-consent"
                  />
                  <span id="voice-agb-consent" className="text-sm text-slate-700">
                    Ich habe die <Link to="/legal/terms" className="underline" target="_blank" rel="noopener noreferrer">AGB</Link>{' '}
                    und die <Link to="/legal/privacy" className="underline" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</Link>{' '}
                    gelesen und akzeptiere sie.
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={acknowledgedWithdrawal}
                    onChange={(e) => setAcknowledgedWithdrawal(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                    aria-describedby="voice-withdrawal-consent"
                  />
                  <span id="voice-withdrawal-consent" className="text-sm text-slate-700">
                    Ich willige ausdrücklich ein, dass mit der Bereitstellung des Dienstes vor Ablauf der
                    14-tägigen Widerrufsfrist begonnen wird, und bestätige, dass mein Widerrufsrecht
                    mit Beginn der Vertragsausführung erlischt (§§ 356 Abs. 5, 327 BGB; siehe{' '}
                    <Link to="/legal/terms" className="underline" target="_blank" rel="noopener noreferrer">AGB § 12</Link> und{' '}
                    <Link to="/legal/widerruf" className="underline" target="_blank" rel="noopener noreferrer">Widerrufsbelehrung</Link>).
                  </span>
                </label>
                {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={!agreedToTerms || !acknowledgedWithdrawal || redirecting}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-teal-800 px-6 py-3 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="voice-checkout-submit"
                >
                  {redirecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  Zahlungspflichtig abonnieren
                </button>
                <p className="text-xs text-slate-500">
                  Weiter zu Stripe für Zahlung und Rechnungsadresse.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
