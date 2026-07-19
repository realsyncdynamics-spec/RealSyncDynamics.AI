import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, Check, Cpu, Zap } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { usePageMeta } from '../../lib/usePageMeta';
import { getPostCheckoutReturn, clearPostCheckoutReturn } from '../../lib/optimizer/state';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';

/**
 * Checkout Success Page — shown after successful payment
 *
 * Fetches subscription details from the database after successful Stripe payment
 * For Agency+ customers, offers quick onboarding to API setup wizard
 */

const API_ENABLED_TIERS = ['agency', 'scale', 'enterprise'];

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenantId } = useTenant();

  const sessionId = searchParams.get('session_id') || searchParams.get('session');
  const [optimizerReturn] = useState<string | null>(() => getPostCheckoutReturn());
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    trialEnds?: string;
  } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  useEffect(() => {
    if (!activeTenantId) {
      setError('Workspace konnte nicht geladen werden');
      setIsVerifying(false);
      return;
    }

    verifyCheckoutSession();
  }, [activeTenantId]);

  const planKey = subscription?.plan || null;
  const planLabel = useMemo(() => {
    if (!planKey) return null;
    const labels: Record<string, string> = {
      starter: 'Starter',
      growth: 'Growth',
      agency: 'Agency',
      scale: 'Scale',
      enterprise: 'Enterprise',
    };
    return labels[planKey] || planKey;
  }, [planKey]);

  // Auto-redirect zum Dashboard nach 5 Sekunden
  useEffect(() => {
    if (subscription && !error && !isVerifying) {
      const timer = setTimeout(() => {
        navigate('/app');
      }, 5000);

      const countdown = setInterval(() => {
        setRedirectCountdown((prev) => prev - 1);
      }, 1000);

      return () => {
        clearTimeout(timer);
        clearInterval(countdown);
      };
    }
  }, [subscription, error, isVerifying, navigate]);

  const verifyCheckoutSession = async () => {
    try {
      if (!activeTenantId) {
        throw new Error('Tenant-ID fehlt');
      }

      const sb = getSupabase();
      const { data, error: fetchErr } = await sb
        .from('subscriptions')
        .select('plan_key, status, trial_end')
        .eq('tenant_id', activeTenantId)
        .maybeSingle();

      if (fetchErr) {
        throw new Error(`Subscription-Abfrage fehlgeschlagen: ${fetchErr.message}`);
      }

      if (!data) {
        throw new Error('Subscription konnte nicht gefunden werden');
      }

      setSubscription({
        plan: data.plan_key || 'Unknown',
        status: data.status || 'pending',
        trialEnds: data.trial_end || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="w-full bg-obsidian-900 min-h-screen flex items-center justify-center px-4">
        <div className="bg-obsidian-800 border border-titanium-700 rounded p-8 max-w-md text-center">
          <div className="inline-block mb-4 text-4xl">⏳</div>
          <h2 className="text-xl font-bold text-titanium-50 mb-2">Zahlung wird verarbeitet...</h2>
          <p className="text-titanium-300">Bitte warte während wir deinen Kauf bestätigen.</p>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="w-full bg-obsidian-900 min-h-screen flex items-center justify-center px-4">
        <div className="bg-obsidian-800 border border-red-700 rounded p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-red-400 mb-4">Fehler</h2>
          <p className="text-titanium-300 mb-6">{error || 'Subscription konnte nicht aktiviert werden'}</p>
          <button
            onClick={() => navigate('/checkout')}
            className="w-full px-4 py-2 bg-security-500 text-white font-bold hover:bg-security-600"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-obsidian-900 min-h-screen flex items-center justify-center px-4 py-16">
      <div className="bg-obsidian-800 border-2 border-security-500 rounded p-8 max-w-xl">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-security-900 rounded-full">
            <svg className="w-8 h-8 text-security-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

          <p className="mt-4 text-sm leading-relaxed text-titanium-300">
            Der Zahlungsstatus wurde von Stripe entgegengenommen. Die Freischaltung
            kann wenige Sekunden dauern — sobald der Webhook das Abonnement
            verarbeitet hat, ist dein Plan im Dashboard sichtbar.
          </p>

          {planLabel ? (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-titanium-500">
              Plan: {planLabel}
            </p>
          ) : null}
          {sessionId ? (
            <p className="mt-1 break-all font-mono text-[11px] text-titanium-500">
              Session: {sessionId}
            </p>
          ) : null}

          {/* OnboardingSteps component to be implemented */}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {optimizerReturn && (
              <Link
                to={optimizerReturn}
                onClick={() => clearPostCheckoutReturn()}
                className="inline-flex items-center gap-2 border border-ai-cyan-500/50 bg-ai-cyan-900/20 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ai-cyan-200 hover:bg-ai-cyan-900/40"
              >
                <Cpu className="h-3.5 w-3.5" /> Weiter zum Optimizer <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            <Link
              to="/app"
              className="inline-flex items-center gap-2 border border-titanium-700 bg-obsidian-950 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-titanium-200 hover:border-titanium-500 hover:text-titanium-50"
            >
              Dashboard öffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 border border-titanium-700 bg-obsidian-950 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-titanium-200 hover:border-titanium-500 hover:text-titanium-50"
            >
              Zurück zur Übersicht
            </Link>
          </div>

        <div className="bg-obsidian-900 rounded border border-obsidian-700 p-6 mb-6">
          <p className="text-xs text-titanium-400 uppercase tracking-wider mb-1">Aktiver Plan</p>
          <p className="text-2xl font-bold text-titanium-50 capitalize">{subscription.plan}</p>
          <p className="text-sm text-security-400 mt-2 font-semibold">{subscription.status}</p>
        </div>

        {/* API Onboarding CTA for Agency+ */}
        {subscription && API_ENABLED_TIERS.includes(subscription.plan.toLowerCase()) && (
          <div className="bg-security-950 border border-security-700 rounded p-4 mb-6">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-security-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-titanium-50 mb-1">API-Zugriff verfügbar</p>
                <p className="text-xs text-titanium-400">
                  Dein Plan beinhaltet API-Zugriff. Erstelle einen Schlüssel um Integrationen zu aktivieren.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            data-testid="checkout-dashboard-button"
            onClick={() => navigate('/app')}
            className="flex-1 px-6 py-3 bg-security-500 text-white font-bold uppercase hover:bg-security-600"
          >
            Zum Dashboard
          </button>

          {/* API Setup Button for Agency+ */}
          {subscription && API_ENABLED_TIERS.includes(subscription.plan.toLowerCase()) && (
            <button
              data-testid="checkout-setup-api-button"
              onClick={() => navigate('/app/api/setup?fromCheckout=true')}
              className="flex-1 px-6 py-3 bg-obsidian-700 text-titanium-100 font-bold uppercase border border-titanium-700 hover:bg-obsidian-600 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" />
              API-Schlüssel erstellen
            </button>
          )}
        </div>

        <p className="text-center text-xs text-titanium-500 mt-4 font-mono">
          Weiterleitung zum Dashboard in {redirectCountdown} Sekunde{redirectCountdown !== 1 ? 'n' : ''}…
        </p>
      </div>
    </div>
  );
}

interface OnboardingStep { label: string; detail: string }

const ONBOARDING_STEPS: Record<string, OnboardingStep[]> = {
  agency: [
    { label: 'E-Mail prüfen', detail: 'Account-Zugang + API-Key innerhalb von 15 Minuten' },
    { label: 'Dashboard öffnen', detail: 'White-Label-Panel, Logo, Farben und eigene Domain konfigurieren' },
    { label: 'Erste Kundenseite hinzufügen', detail: '10 Domains inklusive — Domain-Onboarding im Dashboard unter "Websites"' },
    { label: 'Optional: Setup-Gespräch', detail: 'Unser Team meldet sich innerhalb von 24 h für ein kostenfreies Onboarding-Call' },
  ],
  growth: [
    { label: 'E-Mail prüfen', detail: 'Account-Zugang innerhalb von 15 Minuten' },
    { label: 'Domain hinzufügen', detail: 'Bis zu 3 Domains im Dashboard — tägliches Monitoring startet automatisch' },
    { label: 'Risk-Dashboard öffnen', detail: 'Erste Drift-Events und Consent-Analyse sind sofort sichtbar' },
  ],
  starter: [
    { label: 'E-Mail prüfen', detail: 'Account-Zugang innerhalb von 15 Minuten' },
    { label: 'Domain hinzufügen', detail: '1 Domain — monatlicher Re-Scan startet automatisch' },
  ],
};

function OnboardingSteps({ planKey }: { planKey: string | null }) {
  const steps = planKey ? ONBOARDING_STEPS[planKey] : null;
  if (!steps) return null;
  return (
    <div className="mt-6 border border-titanium-800 bg-obsidian-950 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500 mb-3">
        Nächste Schritte
      </p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3">
            <span className="shrink-0 font-mono text-[10px] text-titanium-600 mt-0.5 w-4">{i + 1}.</span>
            <div>
              <span className="text-xs font-semibold text-titanium-100 flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-400 shrink-0" /> {s.label}
              </span>
              <p className="text-[11px] text-titanium-500 mt-0.5">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function labelForPlanKey(planKey: string | null): string | null {
  switch (planKey) {
    case 'starter':    return 'Starter';
    case 'growth':     return 'Growth';
    case 'agency':     return 'Agency';
    case 'scale':      return 'Scale';
    case 'enterprise': return 'Enterprise';
    default:           return null;
  }
}
