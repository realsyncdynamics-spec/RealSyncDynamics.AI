import { FoundingAccessForm } from '../components/enterprise-ai-os/FoundingAccessForm';

export function EnterpriseAiOsFoundingAccess() {
  return (
    <main className="min-h-screen bg-[#05070d] px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
          Founding Access Program
        </div>

        <h1 className="text-4xl font-semibold tracking-tight">
          14 Tage kostenloser Enterprise-Zugang
        </h1>

        <p className="mt-5 text-zinc-300">
          Für 100 Unternehmen bis 02.08.2026. Im Gegenzug bitten wir um Feedback,
          Verbesserungsvorschläge und Screenshots von Fehlern.
        </p>

        <FoundingAccessForm />

        <p className="mt-8 text-xs text-zinc-500">
          Hinweis: RealSyncDynamics AI unterstützt Dokumentation, Risikomanagement und Governance.
          Es ersetzt keine individuelle Rechtsberatung.
        </p>
      </div>
    </main>
  );
}
