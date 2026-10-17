import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { useTenant } from '../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getSupabaseUrl } from '../lib/supabaseUrl';
import { invalidateEntitlementsCache } from '../core/billing/useEntitlements';
import {
  VERIFY_NETWORK,
  VERIFY_TIMEOUT,
  isRetriableVerifyError,
  parseVerifyResponse,
  resolveVerifiedPlan,
  tenantCandidates,
  type VerifyOutcome,
} from '../features/billing/checkoutVerify';

const VERIFY_TIMEOUT_MS = 15_000;

/**
 * /checkout/success — Stripe success_url landet hier mit session_id + plan_key.
 *
 * Verifiziert die Session gegen stripe-checkout-verify (JWT + Membership),
 * invalidiert den Entitlement-Cache und leitet nach /app/dashboard weiter.
 * Ohne Session: /welcome?next=… (kein zweites Login).
 *
 * Honesty: Stripe-Zahlung ≠ Abo in unserer DB. Solange der Webhook-Sync
 * (oder Verify) noch pending ist, kein Fake-„Abo aktiv“ und kein Auto-
 * Redirect als freigeschaltet. Soft-Continue markiert sync=pending.
 */
export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useSupabaseAuth();
  const tenantState = useTenant();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorRetriable, setErrorRetriable] = useState(false);
  const [statusText, setStatusText] = useState('Zahlung wird bestätigt …');
  const [verifiedPlan, setVerifiedPlan] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [pendingSubId, setPendingSubId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const sessionId = searchParams.get('session_id');
  const planKey = searchParams.get('plan_key');

  const goDashboardSynced = useCallback(
    (subId: string | null, plan: string) => {
      const params = new URLSearchParams();
      if (subId) params.set('subscription', subId);
      params.set('plan', plan);
      navigate(`/app/dashboard?${params.toString()}`);
    },
    [navigate],
  );

  const goDashboardPending = useCallback(
    (subId: string | null, plan: string) => {
      const params = new URLSearchParams();
      params.set('plan', plan);
      params.set('sync', 'pending');
      if (subId) params.set('subscription', subId);
      navigate(`/app/dashboard?${params.toString()}`);
    },
    [navigate],
  );

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

    // Alle Workspaces, in denen der Nutzer einen Checkout starten durfte.
    async function ownerAdminTenants(userId: string): Promise<{ tenantId: string; role: string }[]> {
      const { data } = await getSupabase()
        .from('memberships')
        .select('tenant_id, role')
        .eq('user_id', userId)
        .in('role', ['owner', 'admin']);
      return (data ?? []).map((m) => ({ tenantId: m.tenant_id as string, role: m.role as string }));
    }

    async function verifyOnce(accessToken: string, tenantId: string): Promise<VerifyOutcome> {
      try {
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
            signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
          },
        );
        const data = await response.json().catch(() => ({}));
        return parseVerifyResponse(response.ok, data);
      } catch (err) {
        const timedOut = (err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError';
        return parseVerifyResponse(false, { error: { code: timedOut ? VERIFY_TIMEOUT : VERIFY_NETWORK } });
      }
    }

    function fail(message: string, retriable: boolean) {
      setError(message);
      setErrorRetriable(retriable);
      setLoading(false);
    }

    async function verifyCheckout() {
      setLoading(true);
      setError(null);
      setErrorRetriable(false);
      setSyncPending(false);
      setPendingSubId(null);
      setStatusText('Zahlung wird bestätigt …');

      if (!sessionId) {
        fail('Checkout-Session fehlt', false);
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
      const userId = auth.user.id;

      if (!isSupabaseConfigured()) {
        fail('Supabase ist nicht konfiguriert', false);
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
          fail('Kein Workspace gefunden. Bitte Workspace unter /welcome einrichten.', false);
          return;
        }

        setStatusText('Abo wird mit Stripe abgeglichen …');
        // Der Checkout gehört genau einem Workspace (metadata.tenant_id). Ist
        // nach der Rückkehr ein anderer aktiv, die übrigen Owner/Admin-
        // Workspaces durchprobieren; der Server entscheidet über den Treffer.
        let candidates = [tenantId];
        let matchedTenantId = tenantId;
        let last: VerifyOutcome | null = null;
        for (let i = 0; i < candidates.length; i++) {
          matchedTenantId = candidates[i];
          last = await verifyOnce(accessToken, matchedTenantId);
          if (cancelled) return;
          if (last.ok || (last.code !== 'TENANT_MISMATCH' && last.code !== 'FORBIDDEN')) break;
          if (i === 0) {
            candidates = tenantCandidates(tenantId, await ownerAdminTenants(userId));
            if (cancelled) return;
          }
        }

        for (let attempt = 0; last?.ok && last.pending && attempt < 5; attempt++) {
          setStatusText(`Webhook-Sync ausstehend … Versuch ${attempt + 2}/6`);
          await new Promise((r) => setTimeout(r, 2000));
          if (cancelled) return;
          last = await verifyOnce(accessToken, matchedTenantId);
          if (cancelled) return;
        }

        if (!last) {
          fail('Der Checkout konnte nicht verifiziert werden.', true);
          return;
        }
        if (!last.ok) {
          fail(last.message, isRetriableVerifyError(last.code));
          return;
        }

        invalidateEntitlementsCache();
        if (matchedTenantId !== tenantState.activeTenantId) {
          tenantState.setActiveTenant(matchedTenantId);
        }
        await tenantState.refresh();
        if (cancelled) return;

        const plan = resolveVerifiedPlan(last.subscription, planKey) ?? 'unknown';
        setVerifiedPlan(plan);
        const subId = last.subscription?.id ?? null;

        // Stripe paid, but our subscriptions/entitlements row is not there yet
        // (webhook lag or missing Vault secrets). Do not claim "Abo aktiv".
        if (last.pending) {
          setPendingSubId(subId);
          setSyncPending(true);
          setStatusText('Zahlung bei Stripe bestätigt — Abo-Sync noch ausstehend.');
          setLoading(false);
          return;
        }

        setStatusText('Weiterleitung zum Dashboard …');
        setLoading(false);

        // Freigabe 2026-09-01: Nach dem Kauf → /app/dashboard (nicht /app/billing).
        setTimeout(() => {
          if (!cancelled) {
            goDashboardSynced(subId, plan);
          }
        }, 1200);
      } catch {
        if (cancelled) return;
        fail('Keine Verbindung zum Server. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.', true);
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
    retryKey,
    goDashboardSynced,
  ]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
        <div className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-titanium-700 rounded-card">
          <h1 className="text-2xl font-bold text-titanium-50 mb-4">Checkout unvollständig</h1>
          <p className="text-titanium-300 mb-6" role="alert">{error}</p>
          {errorRetriable && (
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="w-full mb-2 px-4 py-2 bg-[#e8ddc8] hover:bg-[#f0e6d4] text-obsidian-950 font-semibold rounded-card transition-colors"
            >
              Erneut prüfen
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/app/dashboard')}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-card transition-colors"
          >
            Zum Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/pricing')}
            className="w-full mt-2 px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-titanium-200 font-medium rounded-card border border-titanium-700 transition-colors"
          >
            Zurück zur Preisübersicht
          </button>
        </div>
      </div>
    );
  }

  if (syncPending) {
    const plan = verifiedPlan || planKey || 'plan';
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
        <div
          className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-[#e4cfa2]/30 rounded-card text-center"
          data-testid="checkout-sync-pending"
        >
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#e4cfa2]/10 border border-[#e4cfa2]/40">
              <svg className="w-8 h-8 text-[#e4cfa2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-titanium-50 mb-2">Zahlung bestätigt — Sync ausstehend</h1>
          <p className="text-titanium-300 mb-2">
            Stripe hat die Zahlung für{' '}
            <span className="font-semibold font-mono">{plan}</span> angenommen.
            Das Abo ist in unserem System noch nicht freigeschaltet.
          </p>
          <p className="text-sm text-titanium-400 mb-6">
            {statusText} Meist dauert der Webhook wenige Sekunden. Solange der Sync
            fehlt, bleibt das Abo hier gesperrt — kein Fake-„Abo aktiv“.
          </p>

          {pendingSubId && (
            <p className="mb-6 font-mono text-[10px] text-titanium-600">
              stripe_subscription={pendingSubId}
            </p>
          )}

          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="w-full px-4 py-2 bg-[#e8ddc8] hover:bg-[#f0e6d4] text-obsidian-950 font-semibold rounded-card transition-colors"
          >
            Sync erneut prüfen
          </button>
          <button
            type="button"
            onClick={() => goDashboardPending(pendingSubId, plan)}
            className="w-full mt-2 px-4 py-2 bg-obsidian-700 hover:bg-obsidian-600 text-titanium-200 font-medium rounded-card border border-titanium-700 transition-colors"
          >
            Trotzdem zum Dashboard
          </button>
          <Link
            to="/app/billing"
            className="mt-3 inline-block text-sm font-mono text-titanium-400 hover:text-[#e4cfa2]"
          >
            Status unter /app/billing prüfen →
          </Link>
        </div>
      </div>
    );
  }

  // While verify is in flight: confirming chrome only — never green "Abo aktiv".
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
        <div
          className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-titanium-700 rounded-card text-center"
          data-testid="checkout-verifying"
        >
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-obsidian-700 border border-titanium-600 animate-pulse">
              <svg className="w-8 h-8 text-titanium-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-titanium-50 mb-2">Zahlung wird bestätigt</h1>
          <p className="text-titanium-300 mb-2">
            Checkout wird mit Stripe und unserem Abo-Sync abgeglichen.
            Freischaltung erst nach erfolgreicher Verifikation.
          </p>
          <p className="text-sm text-titanium-400 mb-6 font-mono">{statusText}</p>
          <div className="flex justify-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-obsidian-900">
      <div className="max-w-md w-full mx-4 p-8 bg-obsidian-800 border border-titanium-700 rounded-card text-center" data-testid="checkout-synced">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/30 border border-green-600/50 animate-pulse">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-titanium-50 mb-2">Zahlung erfolgreich</h1>
        <p className="text-titanium-300 mb-2">
          Ihr Abo{' '}
          <span className="font-semibold font-mono">{verifiedPlan || planKey || 'plan'}</span>
          {' '}ist freigeschaltet.
        </p>
        <p className="text-sm text-titanium-400 mb-6">
          Weiterleitung zum Dashboard …
        </p>

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
          Jetzt zum Dashboard
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
