import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { useTenant } from '../core/access/TenantProvider';

/**
 * Stripe handoff screen.
 *
 * The browser NEVER grants access. It polls the tenant read model until the
 * signed Stripe webhook has persisted either the subscription or the one-time
 * entitlement grant. If the webhook has not arrived yet, the customer remains
 * in a pending state instead of being shown a false success state.
 */
export default function PostStripeSuccess() {
  const [params] = useSearchParams();
  const { activeTenantId } = useTenant();
  const [status, setStatus] = useState<'confirming' | 'ready' | 'timeout' | 'error'>('confirming');
  const [attempts, setAttempts] = useState(0);

  const sessionId = params.get('session_id') || params.get('session');

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function verify() {
      if (!activeTenantId || !isSupabaseConfigured()) {
        if (!cancelled) setStatus('error');
        return;
      }

      try {
        const supabase = getSupabase();
        const [subscriptionResult, grantResult] = await Promise.all([
          supabase
            .from('subscriptions')
            .select('status')
            .eq('tenant_id', activeTenantId)
            .in('status', ['active', 'trialing'])
            .limit(1)
            .maybeSingle(),
          sessionId
            ? supabase
                .from('entitlement_grants')
                .select('status')
                .eq('tenant_id', activeTenantId)
                .eq('stripe_checkout_session_id', sessionId)
                .eq('status', 'active')
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (subscriptionResult.error) throw subscriptionResult.error;
        if (grantResult.error) throw grantResult.error;

        if (subscriptionResult.data || grantResult.data) {
          if (!cancelled) setStatus('ready');
          return;
        }

        if (attempts >= 10) {
          if (!cancelled) setStatus('timeout');
          return;
        }

        if (!cancelled) setAttempts((value) => value + 1);
        timer = window.setTimeout(verify, 1500);
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void verify();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeTenantId, sessionId, attempts]);

  const pending = status === 'confirming';
  const ready = status === 'ready';

  return (
    <main className="min-h-screen bg-[rgb(3,7,18)] px-4 py-12 text-white">
      <div className="mx-auto max-w-xl text-center">
        {pending ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" /> : ready ? <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /> : <ShieldCheck className="mx-auto h-10 w-10 text-amber-300" />}
        <h1 className="mt-5 text-3xl font-semibold">
          {pending ? 'Zahlung wird bestätigt …' : ready ? 'Projekt freigeschaltet' : 'Freischaltung wird noch verarbeitet'}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/45">
          {pending
            ? 'Stripe hat den Checkout abgeschlossen. Wir warten auf die serverseitige Webhook-Verarbeitung.'
            : ready
              ? 'Dein Entitlement ist bestätigt. Du kannst jetzt mit deiner Website-Transformation arbeiten.'
              : 'Die Zahlung wurde noch nicht im autoritativen Entitlement-Read-Model gefunden. Bitte nicht erneut bezahlen.'}
        </p>

        {ready && (
          <div className="mt-7 flex flex-col gap-3">
            <Link to="/app/siteos" className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300">Zum Website-Transformation-Dashboard</Link>
            <Link to="/app" className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">Zum normalen Dashboard</Link>
          </div>
        )}

        {(status === 'timeout' || status === 'error') && (
          <div className="mt-7 flex flex-col gap-3">
            <button onClick={() => window.location.reload()} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300">Status erneut prüfen</button>
            <Link to="/app" className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">Zum Dashboard</Link>
          </div>
        )}

        {sessionId && <p className="mt-6 font-mono text-[10px] text-white/20">Checkout · {sessionId.slice(0, 14)}…</p>}
        <div className="mt-10 flex items-center justify-center gap-2 text-[10px] text-white/25"><ShieldCheck className="h-3.5 w-3.5" /> Entitlements werden ausschließlich serverseitig vergeben.</div>
      </div>
    </main>
  );
}
