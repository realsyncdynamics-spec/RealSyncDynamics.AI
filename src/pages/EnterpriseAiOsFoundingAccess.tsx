import { Link } from 'react-router-dom';
import { BETA } from '../config/beta';
import { CTA } from '../content/runtimeVocab';
import { monthlyPriceText, planById } from '@/shared/pricing';

const ENTERPRISE = planById('enterprise');

/**
 * Altadresse des Founding-Programms. Das Programm (100 Plätze, Freischaltung
 * über `enterprise-ai-os-founding-access`) endete am 02.08.2026; der Endpoint
 * lehnt seither jede Aktivierung ab. Statt eines Formulars, das nur noch
 * scheitern kann, verweist die Seite auf den Enterprise-Checkout; Enterprise
 * ist nicht Teil der Beta.
 */
export function EnterpriseAiOsFoundingAccess() {
  return (
    <main className="min-h-screen bg-[#05070d] px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
          Founding-Programm beendet
        </div>

        <h1 className="text-4xl font-semibold tracking-tight">
          Enterprise – direkt buchbar
        </h1>

        <p className="mt-5 text-zinc-300">
          Das frühere Founding-Programm ist am 02.08.2026 ausgelaufen. Enterprise buchen Sie heute
          direkt für {monthlyPriceText(ENTERPRISE)}, ohne Testphase. Starter, Growth und Agency sind
          in der offenen Beta bis {BETA.endsLabel} kostenlos.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/checkout/enterprise"
            className="inline-flex rounded-2xl bg-[#d4af37] px-6 py-4 font-semibold text-black"
          >
            {ENTERPRISE.ctaLabel}
          </Link>
          <Link
            to="/contact-sales?source=founding"
            className="inline-flex rounded-2xl border border-[#d4af37]/40 px-6 py-4 font-semibold text-[#d4af37]"
          >
            {CTA.enterprise}
          </Link>
        </div>

        <p className="mt-8 text-xs text-zinc-500">
          Hinweis: RealSyncDynamics AI unterstützt Dokumentation, Risikomanagement und Governance.
          Es ersetzt keine individuelle Rechtsberatung.
        </p>
      </div>
    </main>
  );
}
