import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { getPostCheckoutReturn, clearPostCheckoutReturn } from '../../lib/optimizer/state';

const API_ENABLED_TIERS = ['agency', 'partner', 'enterprise'];
const RECURRING_PLAN_LABELS: Record<string, string> = { starter: 'Starter', growth: 'Growth', agency: 'Agency', enterprise: 'Enterprise', partner: 'Partner' };
type PurchaseState = { kind: 'subscription' | 'governance_launch'; plan: string; status: string; expiresAt?: string };

/** Post-checkout gate. Stripe webhook remains authoritative for entitlement grants. */
export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const sessionId = searchParams.get('session_id') || searchParams.get('session');
  const projectId = searchParams.get('project');
  const [state, setState] = useState<PurchaseState | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(4);
  const optimizerReturn = useMemo(() => getPostCheckoutReturn(), []);

  useEffect(() => {
    if (!activeTenantId) { setError('Workspace konnte nicht geladen werden.'); setVerifying(false); return; }
    void verifyPurchase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenantId, sessionId]);

  useEffect(() => {
    if (!state || verifying || error) return;
    const target = state.kind === 'governance_launch'
      ? (projectId ? `/app/siteos?project=${encodeURIComponent(projectId)}` : '/app/siteos')
      : '/app';
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    const redirect = window.setTimeout(() => navigate(target), 4000);
    return () => { window.clearInterval(timer); window.clearTimeout(redirect); };
  }, [state, verifying, error, navigate, projectId]);

  async function verifyPurchase() {
    setVerifying(true); setError(null);
    try {
      const sb = getSupabase();
      if (sessionId) {
        const { data: grant, error: grantError } = await sb.from('entitlement_grants')
          .select('plan_key,status,expires_at,stripe_checkout_session_id')
          .eq('tenant_id', activeTenantId).eq('stripe_checkout_session_id', sessionId).eq('status', 'active').maybeSingle();
        if (grantError) throw new Error(`Zahlungsfreigabe konnte nicht geprüft werden: ${grantError.message}`);
        if (grant?.plan_key === 'governance_launch') {
          setState({ kind: 'governance_launch', plan: grant.plan_key, status: grant.status, expiresAt: grant.expires_at ?? undefined });
          return;
        }
      }
      const { data: subscription, error: subscriptionError } = await sb.from('subscriptions')
        .select('plan_key,status,trial_end').eq('tenant_id', activeTenantId).maybeSingle();
      if (subscriptionError) throw new Error(`Subscription-Abfrage fehlgeschlagen: ${subscriptionError.message}`);
      if (!subscription) throw new Error('Die Zahlung wurde bestätigt, aber die serverseitige Freischaltung ist noch nicht sichtbar. Bitte kurz warten und erneut öffnen.');
      setState({ kind: 'subscription', plan: subscription.plan_key || 'unknown', status: subscription.status || 'active', expiresAt: subscription.trial_end ?? undefined });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die Zahlung konnte noch nicht verifiziert werden.');
    } finally { setVerifying(false); }
  }

  const planLabel = state ? (RECURRING_PLAN_LABELS[state.plan] ?? state.plan) : null;
  if (verifying) return <div className="min-h-screen bg-obsidian-900 text-titanium-50 flex items-center justify-center px-4"><div className="max-w-md text-center border border-titanium-700 bg-obsidian-800 p-8 rounded"><Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-security-400" /><h1 className="text-xl font-bold">Zahlung wird verifiziert …</h1><p className="mt-3 text-sm text-titanium-400">Wir warten auf die serverseitige Stripe-Freischaltung.</p></div></div>;
  if (error || !state) return <div className="min-h-screen bg-obsidian-900 text-titanium-50 flex items-center justify-center px-4"><div className="max-w-lg text-center border border-red-700 bg-obsidian-800 p-8 rounded"><h1 className="text-xl font-bold text-red-400">Freischaltung noch nicht bestätigt</h1><p className="mt-3 text-sm text-titanium-300">{error ?? 'Kein aktiver Kauf gefunden.'}</p><button onClick={() => void verifyPurchase()} className="mt-6 px-5 py-3 bg-security-500 text-white font-bold uppercase">Erneut prüfen</button></div></div>;

  if (state.kind === 'governance_launch') return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl rounded-3xl border border-cyan-500/40 bg-slate-900 p-8 shadow-2xl">
        <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15"><Check className="h-7 w-7 text-emerald-400" /></div><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-cyan-300">Website Transformation</p><h1 className="text-2xl font-bold">Ihre neue Landingpage ist freigeschaltet</h1></div></div>
        <p className="mt-6 text-sm leading-6 text-slate-300">Die €349 Governance Launch Zahlung wurde serverseitig bestätigt. Ihr Projekt-Dashboard ist jetzt bereit: Analyse, neue Landingpage, Governance-Gate und Veröffentlichung an einem Ort.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">{['Landingpage', 'DSGVO / SEO', 'Governance Gate'].map((item) => <div key={item} className="rounded-2xl border border-slate-700 bg-slate-950 p-4"><Check className="h-4 w-4 text-emerald-400" /><p className="mt-2 text-sm font-semibold">{item}</p><p className="mt-1 text-xs text-slate-500">Freigeschaltet</p></div>)}</div>
        <div className="mt-8 flex flex-wrap gap-3"><Link to={projectId ? `/app/siteos?project=${encodeURIComponent(projectId)}` : '/app/siteos'} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">Transformation öffnen <ArrowRight className="h-4 w-4" /></Link>{optimizerReturn && <Link to={optimizerReturn} onClick={() => clearPostCheckoutReturn()} className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300">Zum Ausgangsprojekt</Link>}</div>
        <p className="mt-5 text-center text-xs font-mono text-slate-500">Dashboard-Weiterleitung in {countdown} Sekunden …</p>
      </div>
    </div>
  );

  const apiEnabled = API_ENABLED_TIERS.includes(state.plan.toLowerCase());
  return <div className="min-h-screen bg-obsidian-900 text-titanium-50 flex items-center justify-center px-4 py-16"><div className="w-full max-w-2xl border-2 border-security-500 bg-obsidian-800 rounded p-8"><div className="flex items-center gap-3"><ShieldCheck className="h-9 w-9 text-security-400" /><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-security-400">Stripe bestätigt</p><h1 className="text-2xl font-bold">Willkommen bei RealSyncDynamics.AI</h1></div></div><div className="mt-6 border border-titanium-700 bg-obsidian-950 p-5"><p className="text-xs uppercase tracking-wider text-titanium-500">Aktiver Plan</p><p className="mt-1 text-2xl font-bold">{planLabel}</p><p className="mt-2 text-sm text-security-400">{state.status}</p></div>{apiEnabled && <div className="mt-4 border border-security-700 bg-security-950 p-4"><div className="flex gap-3"><Zap className="h-5 w-5 text-security-400"/><div><p className="font-semibold">API-Zugriff verfügbar</p><p className="text-xs text-titanium-400">Der API-Setup-Assistent ist im Dashboard verfügbar.</p></div></div></div>}<div className="mt-7 flex gap-3"><Link to="/app" className="flex-1 bg-security-500 px-6 py-3 text-center font-bold uppercase">Zum Dashboard</Link>{apiEnabled && <Link to="/app/api/setup?fromCheckout=true" className="flex-1 border border-titanium-700 px-6 py-3 text-center font-bold uppercase">API einrichten</Link>}</div><p className="mt-4 text-center text-xs font-mono text-titanium-600">Weiterleitung zum Dashboard in {countdown} Sekunden …</p></div></div>;
}
