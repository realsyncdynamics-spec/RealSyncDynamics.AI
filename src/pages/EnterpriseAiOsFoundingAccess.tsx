import { Link } from 'react-router-dom';
import { BETA } from '../config/beta';
import { CTA } from '../content/runtimeVocab';
import { monthlyPriceText, planById } from '@/shared/pricing';

const ENTERPRISE = planById('enterprise');

/**
 * Altadresse des Founding-Programms. Das Programm (100 Plätze, Freischaltung
 * über `enterprise-ai-os-founding-access`) endete am 02.08.2026; der Endpoint
 * lehnt seither jede Aktivierung ab. Statt eines Formulars, das nur noch
 * scheitern kann, verweist die Seite auf die Enterprise-Anfrage; Enterprise
 * ist nicht Teil der Beta und seit 21.11.2026 vorläufig nur auf Anfrage.
 */
export function EnterpriseAiOsFoundingAccess() {
  return (
    <main className="min-h-screen bg-[#05070d] px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
          Founding-Programm beendet
        </div>

        <h1 className="text-4xl font-semibold tracking-tight">
          Enterprise – auf Anfrage
        </h1>

        <p className="mt-5 text-zinc-300">
          Das frühere Founding-Programm ist am 02.08.2026 ausgelaufen. Enterprise kostet{' '}
          {monthlyPriceText(ENTERPRISE)}, ohne Testphase, und ist derzeit nur auf Anfrage erhältlich.
          Starter, Growth und Agency sind in der offenen Beta bis {BETA.endsLabel} kostenlos.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/contact-sales?plan=enterprise&source=founding"
            className="inline-flex rounded-2xl bg-[#d4af37] px-6 py-4 font-semibold text-black"
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
