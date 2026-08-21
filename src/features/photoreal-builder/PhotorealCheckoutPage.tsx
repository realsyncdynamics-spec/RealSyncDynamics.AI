import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { useTenant } from '../../core/access/TenantProvider';
import { createSiteOsCheckoutSession } from '../billing/checkout';
import { loadPending } from './pending';
import { firstInvoice, rungByKey, type RungKey } from './quote';
import { formatEuro } from './uid';

export function PhotorealCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const { activeTenantId } = useTenant();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pending = loadPending();
  const plan = (params.get('plan') || pending?.setup || 'launch') as RungKey;
  const domain = params.get('domain') || pending?.domain || '';
  const rung = rungByKey(plan);
  const today = firstInvoice(plan);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      const next = `/builder/checkout?plan=${encodeURIComponent(plan)}&domain=${encodeURIComponent(domain)}`;
      navigate(`/welcome?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, plan, domain]);

  async function pay() {
    if (!activeTenantId) {
      setError('Bitte zuerst den Workspace einrichten — nach dem Login geht es hier weiter.');
      return;
    }
    const sourceUrl = pending?.sourceUrl || (domain ? `https://${domain}` : '');
    if (!sourceUrl) {
      setError('Domain fehlt. Bitte die Vorschau erneut erzeugen.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await createSiteOsCheckoutSession({
        tenantId: activeTenantId,
        sourceUrl,
        projectName: pending?.company || domain,
      });
      if (!result.ok || !result.url) {
        setError(result.error?.message ?? 'Stripe Checkout konnte nicht vorbereitet werden.');
        return;
      }
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Stripe Checkout konnte nicht vorbereitet werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(3,7,18)] text-white">
      <SEOHead
        title={`${domain || 'Ihre Domain'} geht live`}
        description="Checkout nach der fotorealistischen Vorschau. Einmalig plus erster Monat, danach das Abo."
        canonical="/builder/checkout"
      />
      <div className="mx-auto max-w-lg px-6 py-20">
        <p className="font-mono text-[10px] uppercase tracking-[.22em] text-cyan-400">Checkout</p>
        <h1 className="mt-3 text-4xl tracking-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}>
          {domain ? `${domain} geht live` : 'Diese Seite auf Ihre Domain'}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          {rung.headline} Heute {formatEuro(today)} — {formatEuro(rung.cents)} Umbau plus erster Monat {rung.abo}.
        </p>
        {!isAuthenticated && !authLoading ? (
          <p className="mt-6 text-sm text-white/55">Weiter zur Anmeldung, dann Stripe.</p>
        ) : (
          <button
            type="button"
            disabled={busy || authLoading}
            onClick={() => void pay()}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {busy ? 'Stripe wird vorbereitet…' : `Zahlen · ${formatEuro(today)}`}
          </button>
        )}
        {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
        <p className="mt-6 text-xs text-white/35">
          Live-Stripe über Governance Launch. Nach der Zahlung: Dashboard mit dieser Domain.
        </p>
        <Link to={domain ? `/builder?url=${encodeURIComponent(domain)}` : '/builder'} className="mt-4 inline-block text-sm text-white/50 hover:text-white">
          Zurück zur Vorschau
        </Link>
      </div>
    </div>
  );
}

export default PhotorealCheckoutPage;
