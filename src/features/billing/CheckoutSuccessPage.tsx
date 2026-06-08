import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { usePageMeta } from '../../lib/usePageMeta';

/**
 * /checkout/success — bestaetigt einen erfolgreich uebermittelten
 * Stripe-Checkout. Wichtig: kein Zahlungs-Garantie-Wording.
 * Die endgueltige Aktivierung erfolgt erst, wenn der Webhook
 * `checkout.session.completed` und `customer.subscription.created`
 * verarbeitet hat — das kann wenige Sekunden dauern.
 */
export function CheckoutSuccessPage() {
  usePageMeta({
    title: 'Aktivierung laeuft — RealSyncDynamics.AI',
    description: 'Dein Stripe-Checkout wurde uebermittelt. Die Runtime-Freischaltung erfolgt sobald der Zahlungsstatus bestaetigt ist.',
    url: 'https://realsyncdynamicsai.de/checkout/success',
  });

  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const planKey   = params.get('plan_key');

  // Sanftes Animationsfenster: 3s „aktiviert gleich" -> dann gruener Check.
  const [activating, setActivating] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setActivating(false), 2400);
    return () => window.clearTimeout(timer);
  }, []);

  const planLabel = useMemo(() => labelForPlanKey(planKey), [planKey]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <div className="border border-titanium-800 bg-obsidian-900 p-8">
          <div className="flex items-center gap-3">
            {activating ? (
              <Loader2 className="h-6 w-6 animate-spin text-ai-cyan-400" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            )}
            <h1 className="font-display text-2xl font-bold tracking-tight text-titanium-50">
              {activating ? 'Deine Runtime wird aktiviert.' : 'Runtime aktiviert.'}
            </h1>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-titanium-300">
            {planKey === 'starter' || planKey === 'growth'
              ? 'Ihr 14-Tage-Trial läuft. Keine Kosten bis Tag 15 — jederzeit kündbar.'
              : 'Der Zahlungsstatus wurde von Stripe entgegengenommen.'
            }{' '}
            Die Freischaltung erfolgt sobald der Webhook das Abonnement verarbeitet hat.
          </p>

          {planLabel && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-emerald-400">
              ✓ {planLabel} aktiviert
            </p>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-bold hover:bg-cyan-300 transition-colors"
            >
              Governance Dashboard öffnen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/app/websites"
              className="inline-flex items-center justify-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-400 transition-colors"
            >
              Website-Monitoring starten
            </Link>
          </div>

          <div className="mt-8 flex items-start gap-2 border-t border-titanium-800 pt-4 text-[11px] text-titanium-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-titanium-400" />
            <span>
              Zahlungsabwicklung ueber Stripe (EU-Hosted). Keine automatische
              Rechtsfreigabe — die Runtime liefert technische Vorbereitung,
              Human Review bleibt erforderlich.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function labelForPlanKey(planKey: string | null): string | null {
  switch (planKey) {
    case 'starter':    return 'Starter';
    case 'growth':     return 'Growth';
    case 'agency':     return 'Agency';
    case 'scale':      return 'Scale';
    case 'enterprise': return 'Enterprise';
    default:           return null;
  }
}

export default CheckoutSuccessPage;
