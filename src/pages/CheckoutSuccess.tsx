import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { useTenant } from '../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getSupabaseUrl } from '../lib/supabaseUrl';
import { invalidateEntitlementsCache } from '../core/billing/useEntitlements';

/**
 * /checkout/success — Stripe success_url landet hier mit session_id + plan_key.
 *
 * Verifiziert die Session gegen stripe-checkout-verify (JWT + Membership),
 * invalidiert den Entitlement-Cache und leitet nach /app/dashboard weiter.
 * Ohne Session: /welcome?next=… (kein zweites Login).
 */
export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useSupabaseAuth();
  const tenantState = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Zahlung wird bestätigt …');
  const [verifiedPlan, setVerifiedPlan] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');
  const planKey = searchParams.get('plan_key');

  useEffect(() => {
    let cancelled = false;

    async function waitForTenantId(maxMs = 12_000): Promise<string | null> {
      if (tenantState.activeTenantId) return tenantState.activeTenantId;
      const started = Date.now();
      const supabase = getSupabase();
      while (!cancelled && Date.now() - started < maxMs) {
        await tenantState.refresh();
        const { data: memberships } = await supabase
          .from('memberships')
          .select('tenant_id')
          .in('role', ['owner', 'admin'])
          .limit(1);
        const id = memberships?.[0]?.tenant_id as string | undefined;
        if (id) return id;
        await new Promise((r) => setTimeout(r, 400));
      }
      return tenantState.activeTenantId;
    }

    async function verifyOnce(
      accessToken: string,
      tenantId: string,
    ): Promise<{ ok: boolean; pending?: boolean; subscription?: { id?: string }; error?: string }> {
      const response = await fetch(
        `${getSupabaseUrl()}/functions/v1/stripe-checkout-verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            tenant_id: tenantId,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          error: data?.error?.message || data?.message || 'Failed to verify checkout',
        };
      }
      return data;
    }

    async function verifyCheckout() {
      if (!sessionId) {
        setError('Missing checkout session');
        setLoading(false);
        return;
      }

      if (auth.isLoading) return;

      if (!auth.isAuthenticated || !auth.user?.id) {
        const next = `/checkout/success?session_id=${encodeURIComponent(sessionId)}${
          planKey ? `&plan_key=${encodeURIComponent(planKey)}` : ''
        }`;
        navigate(`/welcome?next=${encodeURIComponent(next)}`, { replace: true });
        return;
      }

      if (!isSupabaseConfigured()) {
        setError('Supabase is not configured');
        setLoading(false);
        return;
      }

      try {
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          const next = `/checkout/success?session_id=${encodeURIComponent(sessionId)}${
            planKey ? `&plan_key=${encodeURIComponent(planKey)}` : ''
          }`;
          navigate(`/welcome?next=${encodeURIComponent(next)}`, { replace: true });
          return;
        }

        setStatusText('Workspace wird geladen …');
        const tenantId = await waitForTenantId();
        if (cancelled) return;
        if (!tenantId) {
          setError('Kein Workspace gefunden. Bitte Workspace unter /welcome einrichten.');
          setLoading(false);
          return;
        }

        setStatusText('Abo wird mit Stripe abgeglichen …');
        let last: Awaited<ReturnType<typeof verifyOnce>> | null = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          last = await verifyOnce(accessToken, tenantId);
          if (cancelled) return;
          if (!last.ok) {
            setError(last.error || 'Failed to verify checkout');
            setLoading(false);
            return;
          }
          if (!last.pending) break;
          setStatusText(`Webhook-Sync ausstehend … Versuch ${attempt + 1}/6`);
          await new Promise((r) => setTimeout(r, 2000));
        }

        invalidateEntitlementsCache();
        await tenantState.refresh();
        if (cancelled) return;

        const subId = last?.subscription?.id ?? 'pending';
        const plan = planKey || 'unknown';
        setVerifiedPlan(plan);
        setStatusText('Weiterleitung zum Dashboard …');
        setLoading(false);

        // Freigabe 2026-09-01: Nach dem Kauf → /app/dashboard (nicht /app/billing).
        setTimeout(() => {
          if (!cancelled) {
            navigate(`/app/dashboard?subscription=${encodeURIComponent(subId)}&plan=${encodeURIComponent(plan)}`);
          }
        }, 1200);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || 'Network error');
        setLoading(false);
      }
    }

    void verifyCheckout();
    return () => {
      cancelled = true;
    };
    // tenantState object identity changes; depend on stable fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional narrow deps
  }, [
    sessionId,
    planKey,
    auth.isLoading,
    auth.isAuthenticated,
    auth.user?.id,
    tenantState.activeTenantId,
    tenantState.loading,
    navigate,
  ]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
        <div className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-titanium-700 rounded-card">
          <h1 className="text-2xl font-bold text-titanium-50 mb-4">Checkout Incomplete</h1>
          <p className="text-titanium-300 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/app/dashboard')}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-card transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/#pricing')}
            className="w-full mt-2 px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-titanium-200 font-medium rounded-card border border-titanium-700 transition-colors"
          >
            Back to Pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
      <div className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-titanium-700 rounded-card text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/30 border border-green-600/50 animate-pulse">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-titanium-50 mb-2">Payment Successful!</h1>
        <p className="text-titanium-300 mb-2">
          Your subscription to{' '}
          <span className="font-semibold font-mono">{verifiedPlan || planKey || 'plan'}</span> is
          activating.
        </p>
        <p className="text-sm text-titanium-400 mb-6">{loading ? statusText : 'Redirecting to your dashboard…'}</p>

        <div className="flex justify-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/dashboard')}
          className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-card transition-colors"
        >
          Go to Dashboard Now
        </button>
        <Link
          to="/app/websites"
          className="mt-3 inline-block text-sm font-mono text-titanium-400 hover:text-cyan-300"
        >
          Domain später unter /app/websites verbinden →
        </Link>
      </div>
    </div>
  );
}
