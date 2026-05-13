import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { ShopifyScanResultView, type ShopifyScanResultView as ScanResult } from '../../features/shopify/ShopifyScanResult';

const SUPABASE_FUNCTIONS_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://ebljyceifhnlzhjfyxup.supabase.co';

export function ShopifySuccessPage() {
  usePageMeta({
    title: 'Shopify verbunden — RealSyncDynamics.AI',
    description: 'Dein Shopify-Store ist verbunden. Starte den ersten Compliance-Scan.',
  });

  const [params] = useSearchParams();
  const shop = params.get('shop') ?? '';

  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const runScan = async () => {
    if (!shop) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`${SUPABASE_FUNCTIONS_URL}/functions/v1/shopify-scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ shop }),
      });
      const body = await r.json();
      if (!r.ok || !body.ok) {
        setErr(body.error?.message ?? `HTTP ${r.status}`);
      } else {
        setScan(body.result as ScanResult);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fire on first load if we have a shop param
  useEffect(() => {
    if (shop && !scan && !loading && !err) runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <Link to="/integrations/shopify" className="flex items-center gap-2 text-titanium-300 hover:text-titanium-100 text-sm">
          <ArrowLeft className="h-4 w-4" /> Shopify Integration
        </Link>
        <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Verbunden
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
        <section>
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-emerald-300 mb-3">
            Store verbunden
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
            {shop || 'Shop'}
          </h1>
          <p className="mt-3 text-silver-300 leading-relaxed">
            Webhooks für <code className="font-mono text-xs">app/uninstalled</code> und{' '}
            <code className="font-mono text-xs">themes/update</code> sind registriert. Der erste
            Scan läuft automatisch — du kannst ihn auch jederzeit erneut starten.
          </p>
        </section>

        <section>
          <button
            onClick={runScan}
            disabled={loading || !shop}
            className="inline-flex items-center gap-2 px-4 py-2 surface-gold text-sm font-bold rounded-none disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loading ? 'Scan läuft…' : 'Scan erneut starten'}
          </button>
          {err && <p className="mt-3 text-xs text-rose-300">Fehler: {err}</p>}
        </section>

        {scan && <ShopifyScanResultView result={scan} />}
      </main>
    </div>
  );
}
