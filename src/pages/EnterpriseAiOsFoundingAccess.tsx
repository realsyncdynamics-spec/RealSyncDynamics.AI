import { Link } from 'react-router-dom';
import { BETA } from '../config/beta';
import { CTA } from '../content/runtimeVocab';

/**
 * Altadresse des Founding-Programms. Das Programm (100 Plätze, Freischaltung
 * über `enterprise-ai-os-founding-access`) endete am 02.08.2026; der Endpoint
 * lehnt seither jede Aktivierung ab. Statt eines Formulars, das nur noch
 * scheitern kann, verweist die Seite auf die Enterprise-Beta (/contact-sales).
 */
export function EnterpriseAiOsFoundingAccess() {
  return (
    <main className="min-h-screen bg-[#05070d] px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
          Enterprise-Beta
        </div>

        <h1 className="text-4xl font-semibold tracking-tight">
          Enterprise-Beta – kostenlos bis {BETA.endsLabel}
        </h1>

        <p className="mt-5 text-zinc-300">
          Das frühere Founding-Programm ist am 02.08.2026 ausgelaufen. Enterprise-Funktionen testen
          Sie jetzt in der offenen Beta: keine Kreditkarte, kein Abo, danach Preis auf Anfrage. Im
          Gegenzug bitten wir um Feedback, Verbesserungsvorschläge und Screenshots von Fehlern.
        </p>

        <Link
          to="/contact-sales?source=founding"
          className="mt-8 inline-flex rounded-2xl bg-[#d4af37] px-6 py-4 font-semibold text-black"
        >
          {CTA.enterprise}
        </Link>

        <p className="mt-8 text-xs text-zinc-500">
          Hinweis: RealSyncDynamics AI unterstützt Dokumentation, Risikomanagement und Governance.
          Es ersetzt keine individuelle Rechtsberatung.
        </p>
      </div>
    </main>
  );
}
