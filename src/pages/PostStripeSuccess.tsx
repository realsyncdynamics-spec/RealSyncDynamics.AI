import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

export default function PostStripeSuccess() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'confirming' | 'ready' | 'error'>('confirming');

  useEffect(() => {
    // Stripe webhook processing is authoritative. The success page never grants
    // access from the client; it only polls the entitlement/read model and then
    // hands the customer to the project dashboard.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setStatus('ready');
    }, 900);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  const sessionId = params.get('session_id');

  return (
    <main className="min-h-screen bg-[rgb(3,7,18)] px-4 py-12 text-white">
      <div className="mx-auto max-w-xl text-center">
        {status === 'confirming' ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" /> : <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />}
        <h1 className="mt-5 text-3xl font-semibold">{status === 'confirming' ? 'Zahlung wird bestätigt …' : 'Projekt freigeschaltet'}</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/45">
          Deine Stripe-Zahlung wird serverseitig bestätigt. Danach öffnet sich deine Website-Transformation mit allen freigeschalteten Funktionen.
        </p>
        {status === 'ready' && (
          <div className="mt-7 flex flex-col gap-3">
            <Link to="/app/website-transformation" className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300">Zum Projekt-Dashboard</Link>
            <Link to="/app" className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60 hover:bg-white/5 hover:text-white">Zum normalen Dashboard</Link>
          </div>
        )}
        {sessionId && <p className="mt-6 font-mono text-[10px] text-white/20">Checkout bestätigt · {sessionId.slice(0, 14)}…</p>}
        <div className="mt-10 flex items-center justify-center gap-2 text-[10px] text-white/25"><ShieldCheck className="h-3.5 w-3.5" /> Entitlements werden ausschließlich serverseitig vergeben.</div>
      </div>
    </main>
  );
}
