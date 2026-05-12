import { BrainCircuit, CheckCircle2, FileSearch, ShieldCheck } from 'lucide-react';

const bullets = [
  'KI-Usecase-Inventar mit EU-AI-Act-Risikoklassen',
  'Identifikation potenzieller High-Risk-Usecases, z. B. Annex-III-Szenarien',
  'Übersicht, welche Pflichten für welchen Usecase gelten',
  'Audit-Logs für technische Nachweise und Post-Market-Monitoring',
  'Mapping auf Logging, Human Oversight, Dokumentation und Kontrollpflichten',
];

export function AiActGovernanceBetaSection() {
  return (
    <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
        <div>
          <div className="inline-flex items-center gap-2 border border-titanium-100/30 bg-titanium-100/5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.22em] text-titanium-100 mb-5">
            <BrainCircuit className="h-3.5 w-3.5" />
            AI-Act-Governance Beta
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-tight">
            AI-Act-Pflichten technisch nachweisbar umsetzen.
          </h2>
          <p className="mt-4 text-silver-300 text-base sm:text-lg leading-relaxed">
            Erfassen Sie Ihre KI-Usecases zentral, ordnen Sie sie den Risikokategorien des EU AI Act
            zu und sehen Sie, welche Pflichten jeweils gelten. RealSyncDynamics.AI verbindet Inventar,
            Risikoklassifizierung, Kontrollen und Nachweise in einer laufenden Governance-Schicht.
          </p>
        </div>
        <div className="bg-obsidian-900/60 border border-silver-700/30 p-6">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="h-5 w-5 text-titanium-100" />
            <h3 className="font-display font-bold text-xl text-titanium-50">
              Continuous AI Governance
            </h3>
          </div>
          <div className="space-y-3">
            {bullets.map((b) => (
              <div
                key={b}
                className="flex items-start gap-3 border border-silver-700/30 bg-obsidian-950/60 p-4"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-sm text-silver-300 leading-relaxed">{b}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-3 border border-titanium-100/20 bg-titanium-100/5 p-4">
            <FileSearch className="h-5 w-5 text-titanium-100 shrink-0" />
            <p className="text-sm text-silver-300 leading-relaxed">
              Ziel ist nicht nur Dokumentation, sondern ein technischer Audit-Trail: Welche KI-Systeme
              existieren, welches Risiko haben sie, welche Kontrollen greifen und welche Evidence liegt vor?
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
