import { Link } from 'react-router-dom';
import { ArrowRight, XCircle } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { usePageMeta } from '../../lib/usePageMeta';

/**
 * /checkout/cancelled — neutraler Abbruch-Screen ohne Druck-Wording.
 * „Du kannst den Plan jederzeit erneut aktivieren." — kein FOMO, kein Trick.
 */
export function CheckoutCancelledPage() {
  usePageMeta({
    title: 'Checkout abgebrochen — RealSyncDynamics.AI',
    description: 'Du hast den Stripe-Checkout abgebrochen. Du kannst den Plan jederzeit erneut aktivieren.',
    url: 'https://realsyncdynamicsai.de/checkout/cancelled',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
        <div className="border border-titanium-800 bg-obsidian-900 p-8">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-titanium-400" />
            <h1 className="font-display text-2xl font-bold tracking-tight text-titanium-50">
              Checkout abgebrochen.
            </h1>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-titanium-300">
            Es wurde keine Zahlung ausgelöst. Du kannst den Plan jederzeit
            erneut aktivieren — der Free-Audit bleibt parallel ohne Account nutzbar.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/pricing"
              className="surface-mono inline-flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-wide"
            >
              Pläne ansehen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/audit"
              className="inline-flex items-center gap-2 border border-titanium-700 bg-obsidian-950 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-titanium-200 hover:border-titanium-500 hover:text-titanium-50"
            >
              Kostenlosen Check starten
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CheckoutCancelledPage;
