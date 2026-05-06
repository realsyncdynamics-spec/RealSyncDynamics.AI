import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, ArrowRight, ShieldCheck, Loader2, AlertTriangle,
  ExternalLink, Cpu, Layers, Users,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';

interface Subscription {
  plan_key: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface Product {
  name: string;
  default_for_plan_key: string;
  stripe_price_id: string;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  enterprise_public: 'Enterprise',
};

export function BillingView() {
  const { tenants, activeTenantId, entitlements, loading, getLimit } = useTenant();
  const activeTenant = tenants.find((t) => t.tenantId === activeTenantId);
  const canManage = activeTenant?.role === 'owner' || activeTenant?.role === 'admin';

  const [sub, setSub] = useState<Subscription | null | 'none'>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!activeTenantId) return;
    let cancelled = false;
    setSub(null); setProduct(null); setError(null);

    (async () => {
      const sb = getSupabase();
      const { data: subRow, error: subErr } = await sb
        .from('subscriptions')
        .select('plan_key, status, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
        .eq('tenant_id', activeTenantId).maybeSingle();
      if (cancelled) return;
      if (subErr) { setError(subErr.message); return; }

      if (!subRow) { setSub('none'); return; }
      setSub(subRow as Subscription);

      if (subRow.plan_key) {
        const { data: prod } = await sb
          .from('products').select('name, default_for_plan_key, stripe_price_id')
          .eq('default_for_plan_key', subRow.plan_key)
          .not('stripe_price_id', 'like', 'internal_default_%')
          .maybeSingle();
        if (!cancelled) setProduct(prod as Product | null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  async function openPortal() {
    if (!activeTenantId) return;
    setOpening(true); setError(null);
    try {
      const sb = getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('not signed in');
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            return_url: window.location.href,
          }),
        },
      );
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error?.message ?? `HTTP ${resp.status}`);
      window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
      setOpening(false);
    }
  }

  if (loading || sub === null) {
    return <Loading />;
  }

  if (!activeTenantId) {
    return <NoTenant />;
  }

  const planLabel = sub === 'none'
    ? 'Free (kein Abonnement)'
    : (PLAN_LABELS[sub.plan_key ?? 'free'] ?? sub.plan_key ?? 'Free');

  const periodEnd = sub !== 'none' && sub.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('de-DE')
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-titanium-50 tracking-tight">Abrechnung & Plan</h1>
        <p className="text-sm text-titanium-400 mt-1">
          Aktueller Plan + Stripe-Portal für Zahlungsmethode, Rechnungen und Kündigung.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan */}
        <div className="md:col-span-2 bg-obsidian-900 rounded-none border border-titanium-900 p-6 relative">
          <div className="absolute top-4 right-4">
            <StatusBadge status={sub === 'none' ? 'free' : sub.status} cancelAt={sub !== 'none' ? sub.cancel_at_period_end : false} />
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-obsidian-950 text-white rounded-none flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-titanium-50">{planLabel}</h2>
              {product && (
                <p className="text-sm text-titanium-400">{product.name}</p>
              )}
              {sub !== 'none' && periodEnd && (
                <p className="text-xs text-titanium-500 mt-0.5">
                  {sub.cancel_at_period_end
                    ? `Endet am ${periodEnd}`
                    : `Verlängert sich am ${periodEnd}`}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <Entitlement label="AI-Aufrufe / Monat"  value={getLimit('limit.ai_calls_monthly')} />
            <Entitlement label="AI-Tokens / Monat"   value={getLimit('limit.ai_tokens_monthly')} />
            <Entitlement label="Workflow-Runs / Monat" value={getLimit('limit.workflow_runs_monthly')} />
            <Entitlement label="Aktive Assets"       value={getLimit('limit.active_assets')} />
            <Entitlement label="Team-Seats"          value={getLimit('limit.team_seats')} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/pricing" className="px-4 py-2 bg-security-500 hover:bg-security-600 text-white text-sm font-semibold rounded-none flex items-center gap-2">
              <Layers className="h-4 w-4" /> Plan ändern
            </Link>
            <Link to="/billing/usage" className="px-4 py-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 text-titanium-200 text-sm font-semibold rounded-none flex items-center gap-2">
              <Cpu className="h-4 w-4" /> Verbrauch
            </Link>
            {sub !== 'none' && sub.stripe_customer_id && canManage && (
              <button onClick={openPortal} disabled={opening}
                className="px-4 py-2 bg-obsidian-950 border border-titanium-900 hover:bg-obsidian-800 text-titanium-200 text-sm font-semibold rounded-none flex items-center gap-2 disabled:opacity-50">
                {opening
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <CreditCard className="h-4 w-4" />}
                Stripe-Portal
                <ExternalLink className="h-3 w-3 opacity-60" />
              </button>
            )}
          </div>

          {!canManage && sub !== 'none' && (
            <p className="text-xs text-titanium-500 mt-4">
              Nur Workspace-Owner/Admins können Plan + Zahlungsmethode verwalten.
            </p>
          )}
        </div>

        {/* Quick Info */}
        <div className="bg-obsidian-900 rounded-none border border-titanium-900 p-6 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Zahlung
            </h3>
            {sub === 'none' || !sub.stripe_customer_id ? (
              <p className="text-sm text-titanium-400 leading-relaxed">
                Noch kein zahlungspflichtiger Plan. Über <Link to="/pricing" className="text-security-400">/pricing</Link> einen Plan buchen, dann läuft alles über Stripe.
              </p>
            ) : (
              <p className="text-sm text-titanium-300 leading-relaxed">
                Karte, IBAN, Steuer-ID, Rechnungen — alles im Stripe-Portal verwalten.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Team
            </h3>
            <Link to="/tenant/invites" className="text-sm text-security-400 hover:underline flex items-center gap-1">
              Mitglieder verwalten <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div>
            <h3 className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Datenschutz
            </h3>
            <Link to="/settings/account" className="block text-sm text-security-400 hover:underline mb-1">
              Mein Account · DSGVO
            </Link>
            <Link to="/legal/sub-processors" className="block text-sm text-security-400 hover:underline">
              Sub-Prozessoren
            </Link>
          </div>
        </div>
      </div>

      <p className="text-xs text-titanium-500 text-center">
        Rechnungen + Zahlungshistorie verwalten wir nicht selbst — alles im Stripe-Portal-Knopf oben.
        Steuer- und Buchhaltungsfragen: <a href="mailto:billing@realsyncdynamicsai.de" className="text-security-400">billing@realsyncdynamicsai.de</a>.
      </p>
    </div>
  );
}

function Entitlement({ label, value }: { label: string; value: number | null }) {
  const display = value === null
    ? '–'
    : value === -1
    ? 'unbegrenzt'
    : value.toLocaleString('de-DE');
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-titanium-900/40 last:border-0">
      <span className="text-titanium-300">{label}</span>
      <span className="text-titanium-50 font-mono tabular-nums">{display}</span>
    </div>
  );
}

function StatusBadge({ status, cancelAt }: { status: string; cancelAt: boolean }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:           { label: 'Aktiv',        cls: 'bg-emerald-950/40 text-emerald-300 border-emerald-900' },
    trialing:         { label: 'Test',         cls: 'bg-blue-950/40 text-blue-300 border-blue-900' },
    past_due:         { label: 'Überfällig',   cls: 'bg-amber-950/40 text-amber-300 border-amber-900' },
    canceled:         { label: 'Gekündigt',    cls: 'bg-red-950/40 text-red-300 border-red-900' },
    unpaid:           { label: 'Unbezahlt',    cls: 'bg-red-950/40 text-red-300 border-red-900' },
    incomplete:       { label: 'Incomplete',   cls: 'bg-amber-950/40 text-amber-300 border-amber-900' },
    free:             { label: 'Free',         cls: 'bg-titanium-900 text-titanium-300 border-titanium-700' },
    checkout_pending: { label: 'Checkout',     cls: 'bg-blue-950/40 text-blue-300 border-blue-900' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-titanium-900 text-titanium-300 border-titanium-700' };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 border rounded-none ${m.cls}`}>
      {m.label}{cancelAt && status === 'active' ? ' · läuft aus' : ''}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> Lade…
    </div>
  );
}

function NoTenant() {
  return (
    <div className="text-center py-16">
      <Users className="h-10 w-10 text-titanium-600 mx-auto mb-3" />
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Kein Workspace</h2>
      <p className="text-sm text-titanium-400">Erst Mitglied eines Workspaces werden, dann gibt's Billing.</p>
    </div>
  );
}
