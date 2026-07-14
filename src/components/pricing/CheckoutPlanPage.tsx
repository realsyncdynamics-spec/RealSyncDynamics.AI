import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { getPlanBySlug, getFeaturesByPlan } from '../../content/pricingContent';
import { getSupabase } from '../../lib/supabase';
import { createCheckoutSession, type PlanKey } from '../../features/billing/checkout';

interface CheckoutPlanPageProps {
  planSlug: string;
}

type AuthState =
  | { status: 'loading' }
  | { status: 'no_user' }
  | { status: 'no_tenant'; userEmail: string }
  | { status: 'ready'; userEmail: string; tenantId: string };

export function CheckoutPlanPage({ planSlug }: CheckoutPlanPageProps) {
  const navigate = useNavigate();
  const plan = getPlanBySlug(planSlug);
  const features = getFeaturesByPlan(planSlug);
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!plan) {
    return (
      <div className="min-h-screen bg-hero-only flex items-center justify-center text-titanium-50">
        <div className="text-center">
          <h1 className="font-display font-bold text-3xl mb-4">Paket nicht gefunden</h1>
          <Link to="/pricing" className="surface-mono inline-flex items-center gap-2 px-5 py-3 text-sm font-bold">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  // Check auth state on mount
  useEffect(() => {
    if (plan.slug === 'free-audit') {
      return; // No auth needed for free audit
    }

    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const { data: userData } = await sb.auth.getUser();
      if (cancelled) return;

      if (!userData?.user) {
        setAuth({ status: 'no_user' });
        return;
      }

      const userEmail = userData.user.email ?? '';
      const { data: memberships } = await sb
        .from('memberships')
        .select('tenant_id, role')
        .in('role', ['owner', 'admin'])
        .limit(1);

      if (cancelled) return;

      const firstTenant = memberships?.[0];
      if (!firstTenant?.tenant_id) {
        setAuth({ status: 'no_tenant', userEmail });
        return;
      }

      setAuth({ status: 'ready', userEmail, tenantId: firstTenant.tenant_id });
    })();

    return () => { cancelled = true; };
  }, [plan.slug]);

  const handleCheckout = async () => {
    if (plan.slug === 'free-audit') {
      // Free audit → direct to audit page
      navigate('/audit?source=checkout-free-audit');
      return;
    }

    // All paid plans require auth
    if (auth.status !== 'ready') {
      if (auth.status === 'no_user') {
        navigate(`/welcome?next=/checkout/${plan.slug}`);
      } else if (auth.status === 'no_tenant') {
        navigate('/welcome?create_tenant=true&next=/checkout/' + plan.slug);
      }
      return;
    }

    // Proceed with Stripe checkout
    setIsProcessing(true);
    setCheckoutError(null);

    try {
      const result = await createCheckoutSession(auth.tenantId, plan.slug as PlanKey);
      if (result.ok && result.url) {
        window.location.href = result.url;
      } else {
        setCheckoutError(result.error?.message || 'Checkout-Fehler. Bitte versuchen Sie es später erneut.');
      }
    } catch (err) {
      setCheckoutError('Netzwerkfehler. Bitte versuchen Sie es später erneut.');
    } finally {
      setIsProcessing(false);
    }
  };

  const displayFeatures = features.slice(0, 5); // Show top 5 features

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50" data-testid={`checkout-plan-${plan.slug}`}>
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center">
        <Link to={`/pricing/${plan.slug}`} className="inline-flex items-center gap-1.5 text-sm text-silver-300 hover:text-titanium-50" data-testid="checkout-back">
          <ArrowLeft className="h-4 w-4" />
          Zurück zum Plan
        </Link>
      </div>

      {/* Main content */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex-grow">
        <div className="max-w-2xl mx-auto">
          {/* Show login prompt if not authenticated */}
          {auth.status === 'no_user' && plan.slug !== 'free-audit' && (
            <div className="mb-8">
              <h1 className="font-display font-bold text-3xl mb-4 text-titanium-50">Anmelden, um {plan.name} zu buchen</h1>
              <p className="text-base text-silver-300 mb-6 leading-relaxed">
                Melden Sie sich an oder erstellen Sie ein Konto, um Ihren Checkout fortzufahren. Sie werden sofort wieder hier — der Checkout startet automatisch.
              </p>
            </div>
          )}

          {/* Plan summary card */}
          <div className="mb-8 p-8 bg-obsidian-900/60 border border-titanium-200/30 rounded-none">
            {/* Plan name and price */}
            <div className="mb-6 pb-6 border-b border-silver-700/30">
              <h2 className="font-display font-bold text-3xl mb-2">{plan.name}</h2>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{plan.priceString}</span>
                {plan.price > 0 && <span className="text-base text-silver-300">/{plan.interval}</span>}
              </div>
            </div>

            {/* Trial info */}
            {plan.trial && (
              <div className="mb-6 p-4 bg-obsidian-950/60 border border-titanium-200/20 rounded-none">
                <p className="text-sm text-titanium-300">
                  <strong className="text-titanium-100">{plan.trial.days} Tage kostenlos testen</strong>
                  <br />
                  <span className="text-[12px]">{plan.trial.description}</span>
                </p>
              </div>
            )}

            {/* Short description */}
            <p className="text-base text-silver-300 mb-6 leading-relaxed">{plan.shortDescription}</p>

            {/* Key features */}
            <div className="mb-6">
              <h3 className="font-display font-bold text-titanium-50 mb-3 text-sm uppercase tracking-wider">
                Wichtigste Leistungen
              </h3>
              <ul className="space-y-2">
                {displayFeatures.map((feature) => (
                  <li key={feature.slug} className="flex items-start gap-2 text-sm text-silver-300" data-testid={`checkout-feature-${feature.slug}`}>
                    <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{feature.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Error message if checkout failed */}
            {checkoutError && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-500/30 rounded-none">
                <p className="text-sm text-red-300">{checkoutError}</p>
              </div>
            )}

            {/* Main CTA button */}
            <button
              onClick={handleCheckout}
              disabled={isProcessing || (auth.status !== 'loading' && auth.status !== 'ready' && plan.slug !== 'free-audit')}
              className="w-full py-4 text-base font-bold rounded-none text-center bg-titanium-100 text-obsidian-950 hover:bg-titanium-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              data-testid="checkout-book-button"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {plan.cta.label}
            </button>
          </div>

          {/* What's included section */}
          <section className="mb-12">
            <h2 className="font-display font-bold text-2xl mb-6">Was ist alles enthalten?</h2>
            <div className="grid grid-cols-1 gap-4">
              {features.map((feature) => (
                <div key={feature.slug} className="p-4 bg-obsidian-900/60 border border-silver-700/30 rounded-none">
                  <h3 className="font-display font-bold text-titanium-50 mb-1">{feature.title}</h3>
                  <p className="text-sm text-silver-300 mb-3">{feature.subtitle}</p>
                  <Link
                    to={`/features/${feature.slug}`}
                    className="text-[12px] font-bold text-titanium-300 hover:text-titanium-100 uppercase tracking-wider"
                  >
                    Mehr Details →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ section */}
          <section className="mb-12">
            <h2 className="font-display font-bold text-2xl mb-6">Häufige Fragen zur Buchung</h2>
            <div className="space-y-3">
              {[
                {
                  q: 'Benötige ich ein Kundenkonto?',
                  a: 'Ja, für alle kostenpflichtigen Pläne. Das Konto wird nach erfolgreicher Zahlung sofort angelegt.',
                },
                {
                  q: 'Wie funktioniert die Stornierung?',
                  a: 'Monatlich kündbar, formlos per E-Mail an support@realsyncdynamicsai.de. Keine Mindestlaufzeit.',
                },
                {
                  q: 'Welche Zahlungsmethoden werden akzeptiert?',
                  a: 'Wir akzeptieren alle gängigen Zahlungsmethoden über Stripe: Kreditkarten, Lastschrift, Apple Pay, Google Pay.',
                },
                {
                  q: 'Gibt es einen AVV (Auftragsverarbeitungsvertrag)?',
                  a: 'Ja. Der AVV ist ab Buchung automatisch aktiv und verfügbar unter /legal/avv.',
                },
              ].map((item, idx) => (
                <details
                  key={idx}
                  className="group p-4 bg-obsidian-900/60 border border-silver-700/30 hover:border-titanium-200/60 rounded-none transition-colors cursor-pointer"
                >
                  <summary className="flex items-center justify-between gap-3 list-none font-display font-bold text-titanium-50">
                    {item.q}
                    <span className="text-titanium-100 text-xl leading-none transition-transform group-open:rotate-45 select-none">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-silver-300 leading-relaxed mt-3">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <div className="sticky bottom-0 left-0 right-0 -mx-4 -mb-0 px-4 py-4 bg-gradient-to-t from-obsidian-950 to-obsidian-950/50 border-t border-silver-700/30">
            <button
              onClick={handleCheckout}
              disabled={isProcessing || (auth.status !== 'loading' && auth.status !== 'ready' && plan.slug !== 'free-audit' && plan.slug !== 'enterprise')}
              className="w-full py-4 text-base font-bold rounded-none text-center bg-titanium-100 text-obsidian-950 hover:bg-titanium-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              data-testid="checkout-book-button"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {plan.cta.label}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4 mt-12">
        <div className="max-w-5xl mx-auto text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <p>© 2026 RealSync Dynamics · Made in Germany</p>
        </div>
      </footer>
    </div>
  );
}
