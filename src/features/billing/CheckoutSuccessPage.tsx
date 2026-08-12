import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import {
  ORDERED_PLANS,
  checkoutHrefForPlan,
  planByKey,
} from '@/shared/pricing';

type Fulfillment =
  | { kind: 'one_time'; planKey: string }
  | { kind: 'subscription'; planKey: string; status: string; trialEnds: string | null }
  | { kind: 'pending' };

interface GrantRow {
  plan_key: string;
}

interface SubscriptionRow {
  plan_key: string;
  status: string;
  trial_end: string | null;
}

/**
 * The webhook is the only writer for payment fulfillment. This page only
 * observes tenant-scoped records, so a browser cannot grant itself access.
 */
export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const { activeTenantId } = useTenant();
  const sessionId = searchParams.get('session_id') ?? searchParams.get('session');
  const requestedPlan = planByKey(searchParams.get('plan_key'));
  const [fulfillment, setFulfillment] = useState<Fulfillment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);

  const recommendedPlan = useMemo(
    () => ORDERED_PLANS.find((plan) => plan.highlight && plan.purchaseMode === 'checkout') ?? null,
    [],
  );

  const verifyCheckout = useCallback(async () => {
    if (!activeTenantId || !sessionId) {
      setError(!sessionId ? 'Stripe-Checkout-Session fehlt.' : 'Workspace konnte nicht geladen werden.');
      setIsVerifying(false);
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const [grantResult, subscriptionResult] = await Promise.all([
        supabase
          .from('entitlement_grants')
          .select('plan_key')
          .eq('tenant_id', activeTenantId)
          .eq('stripe_checkout_session_id', sessionId)
          .eq('status', 'active')
          .maybeSingle(),
        supabase
          .from('subscriptions')
          .select('plan_key, status, trial_end')
          .eq('tenant_id', activeTenantId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (grantResult.error) {
        throw new Error(`Freischaltung konnte nicht geprüft werden: ${grantResult.error.message}`);
      }
      if (subscriptionResult.error) {
        throw new Error(`Abonnement konnte nicht geprüft werden: ${subscriptionResult.error.message}`);
      }

      const grant = grantResult.data as GrantRow | null;
      if (grant?.plan_key) {
        setFulfillment({ kind: 'one_time', planKey: grant.plan_key });
        return;
      }

      const subscription = subscriptionResult.data as SubscriptionRow | null;
      if (requestedPlan?.purchaseMode === 'one_time') {
        // Stripe has redirected the customer, but the asynchronous webhook has
        // not persisted the grant yet. Do not misrepresent this as a failed payment.
        setFulfillment({ kind: 'pending' });
        return;
      }
      if (subscription?.plan_key) {
        setFulfillment({
          kind: 'subscription',
          planKey: subscription.plan_key,
          status: subscription.status,
          trialEnds: subscription.trial_end,
        });
        return;
      }

      setFulfillment({ kind: 'pending' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Zahlung konnte nicht geprüft werden.');
    } finally {
      setIsVerifying(false);
    }
  }, [activeTenantId, requestedPlan?.purchaseMode, sessionId]);

  useEffect(() => {
    void verifyCheckout();
  }, [verifyCheckout]);

  if (isVerifying) {
    return <StatusShell title="Zahlung wird verarbeitet" detail="Wir prüfen die Freischaltung in Ihrem Workspace." loading />;
  }

  if (error) {
    return (
      <StatusShell title="Prüfung nicht möglich" detail={error}>
        <button type="button" onClick={() => void verifyCheckout()} className="inline-flex items-center gap-2 bg-security-500 px-4 py-2 text-sm font-semibold text-white hover:bg-security-600">
          <RefreshCw className="h-4 w-4" /> Erneut prüfen
        </button>
        <Link to="/app/billing" className="border border-titanium-700 px-4 py-2 text-sm font-semibold text-titanium-100 hover:border-titanium-500">Abrechnung öffnen</Link>
      </StatusShell>
    );
  }

  if (fulfillment?.kind === 'pending') {
    return (
      <StatusShell
        title="Freischaltung wird abgeschlossen"
        detail="Stripe hat die Zahlung entgegengenommen. Die Berechtigung wird nach dem Prüfpfad des Zahlungs-Webhooks in wenigen Sekunden sichtbar."
      >
        <button type="button" onClick={() => void verifyCheckout()} className="inline-flex items-center gap-2 bg-security-500 px-4 py-2 text-sm font-semibold text-white hover:bg-security-600">
          <RefreshCw className="h-4 w-4" /> Status aktualisieren
        </button>
        <Link to="/app" className="border border-titanium-700 px-4 py-2 text-sm font-semibold text-titanium-100 hover:border-titanium-500">Zum Dashboard</Link>
      </StatusShell>
    );
  }

  if (fulfillment?.kind === 'one_time') {
    const purchasedPlan = planByKey(fulfillment.planKey);
    return (
      <StatusShell
        title="Einmalige Freischaltung bestätigt"
        detail={`${purchasedPlan?.name ?? fulfillment.planKey} ist dauerhaft für diesen Workspace freigeschaltet. Ihr bestehendes Abonnement bleibt unverändert.`}
        success
      >
        {recommendedPlan && (
          <div className="border border-titanium-700 bg-obsidian-950 p-4 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">Empfohlene laufende Absicherung</p>
            <p className="mt-1 text-sm font-semibold text-titanium-50">{recommendedPlan.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-titanium-400">{recommendedPlan.outcomeHeadline}</p>
            <Link to={checkoutHrefForPlan(recommendedPlan)} className="mt-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-security-400 hover:text-security-300">
              {recommendedPlan.name} ansehen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        <Link to="/app" className="inline-flex items-center gap-2 bg-security-500 px-4 py-2 text-sm font-semibold text-white hover:bg-security-600">Zum Dashboard <ArrowRight className="h-4 w-4" /></Link>
      </StatusShell>
    );
  }

  if (fulfillment?.kind === 'subscription') {
    const plan = planByKey(fulfillment.planKey);
    const trialDetail = fulfillment.trialEnds
      ? ` Testphase bis ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(fulfillment.trialEnds))}.`
      : '';
    return (
      <StatusShell
        title="Abonnement bestätigt"
        detail={`${plan?.name ?? fulfillment.planKey} ist ${fulfillment.status}.${trialDetail}`}
        success
      >
        <Link to="/app" className="inline-flex items-center gap-2 bg-security-500 px-4 py-2 text-sm font-semibold text-white hover:bg-security-600">Zum Dashboard <ArrowRight className="h-4 w-4" /></Link>
      </StatusShell>
    );
  }

  return null;
}

function StatusShell({
  title,
  detail,
  loading = false,
  success = false,
  children,
}: {
  title: string;
  detail: string;
  loading?: boolean;
  success?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-obsidian-900 px-4">
      <section className="w-full max-w-xl border border-titanium-700 bg-obsidian-800 p-8 text-center">
        {loading ? (
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-security-400" />
        ) : success ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        ) : (
          <ShieldCheck className="mx-auto h-10 w-10 text-security-400" />
        )}
        <h1 className="mt-5 text-2xl font-bold text-titanium-50">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-titanium-300">{detail}</p>
        {children && <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>}
      </section>
    </main>
  );
}
