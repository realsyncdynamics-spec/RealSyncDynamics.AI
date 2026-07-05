/**
 * Checkout Success Page — shown after successful payment
 *
 * Fetches subscription details from the database after successful Stripe payment
 * For Agency+ customers, offers quick onboarding to API setup wizard
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';

const API_ENABLED_TIERS = ['agency', 'scale', 'enterprise'];

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTenantId } = useTenant();

  const sessionId = searchParams.get('session_id') || searchParams.get('session');
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    trialEnds?: string;
  } | null>(null);

  useEffect(() => {
    if (!activeTenantId) {
      setError('Workspace konnte nicht geladen werden');
      setIsVerifying(false);
      return;
    }

    verifyCheckoutSession();
  }, [activeTenantId]);

  const verifyCheckoutSession = async () => {
    try {
      if (!activeTenantId) {
        throw new Error('Tenant-ID fehlt');
      }

      const sb = getSupabase();
      const { data, error: fetchErr } = await sb
        .from('subscriptions')
        .select('plan_key, stripe_subscription_status, trial_ends_at')
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
        status: data.stripe_subscription_status || 'pending',
        trialEnds: data.trial_ends_at || undefined,
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

        <h1 className="text-3xl font-bold text-titanium-50 text-center mb-2">Willkommen!</h1>
        <p className="text-titanium-300 text-center mb-6">Dein Abo wurde erfolgreich aktiviert.</p>

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
              onClick={() => navigate('/app/api/setup')}
              className="flex-1 px-6 py-3 bg-obsidian-700 text-titanium-100 font-bold uppercase border border-titanium-700 hover:bg-obsidian-600 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4" />
              API-Schlüssel erstellen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
