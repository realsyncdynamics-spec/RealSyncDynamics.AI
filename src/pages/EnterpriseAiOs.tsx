import { Link } from 'react-router-dom';

const MODULES = [
  'AI Inventory',
  'Shadow AI Detection',
  'Agent Policies',
  'Audit Trail',
  'Data Flow Mapping',
  'Risk Classification',
  'DSGVO Governance',
  'EU AI Act Readiness',
];

const PROBLEM_SOLUTION = [
  [
    'Problem',
    'Shadow AI, Datenabfluss und fehlende Governance entstehen bereits heute in fast jedem Unternehmen.',
  ],
  [
    'Lösung',
    'RealSyncDynamics AI legt sich als Governance- und Orchestration-Layer über bestehende Systeme.',
  ],
  [
    'Ergebnis',
    'Mehr Transparenz, kontrollierte KI-Nutzung, dokumentierte Risiken und auditierbare Entscheidungen.',
  ],
] as const;

export function EnterpriseAiOs() {
  return (
    <main className="min-h-screen bg-[#05070d] text-white">
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-4xl">
          <div className="mb-6 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-sm text-[#d4af37]">
            Founding Access · 14 Tage kostenlos · limitiert auf 100 Unternehmen
          </div>

          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Das KI-Betriebssystem für kontrollierte Unternehmens-KI
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-zinc-300 md:text-xl">
            Verbinde bestehende Systeme, steuere KI-Agenten, dokumentiere Risiken und unterstütze
            die Umsetzung von DSGVO &amp; EU AI Act — ohne deine bestehende IT-Landschaft zu
            ersetzen.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/enterprise-ai-os/founding-access"
              className="rounded-2xl bg-[#d4af37] px-6 py-4 text-center font-semibold text-black shadow-lg shadow-[#d4af37]/20"
            >
              Founding Access starten
            </Link>

            <Link
              to="/dashboard/enterprise-ai-os"
              className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white"
            >
              Dashboard ansehen
            </Link>
          </div>

          <p className="mt-4 text-sm text-zinc-500">
            Kostenlos bis maximal 02.08.2026 oder bis die ersten 100 Unternehmen aktiviert wurden.
            Gegenleistung: Feedback, Verbesserungsvorschläge und Screenshots von Fehlern.
          </p>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-16 md:grid-cols-3">
          {PROBLEM_SOLUTION.map(([title, text]) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            >
              <h2 className="text-xl font-semibold text-[#d4af37]">{title}</h2>
              <p className="mt-4 text-zinc-300">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-3xl font-semibold">Enterprise AI Control Layer</h2>
        <div className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-6 font-mono text-sm text-zinc-300">
          <div>[Mitarbeiter]</div>
          <div className="text-[#d4af37]">↓</div>
          <div>[AI Runtime / Agent Layer]</div>
          <div className="text-[#d4af37]">↓</div>
          <div>[RealSync Governance Kernel]</div>
          <div className="text-[#d4af37]">↓</div>
          <div>SAP · CRM · Microsoft 365 · Slack · ERP · APIs · Files</div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module) => (
            <div
              key={module}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-zinc-200"
            >
              {module}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="rounded-3xl border border-[#d4af37]/30 bg-[#d4af37]/10 p-8">
          <h2 className="text-2xl font-semibold text-[#d4af37]">
            Founding Access für die ersten 100 Unternehmen
          </h2>
          <p className="mt-4 max-w-3xl text-zinc-200">
            Erhalte 14 Tage Zugang zu allen Enterprise-Funktionen. Dafür hilfst du mit echtem
            Produktfeedback, Verbesserungsvorschlägen und Screenshots von Fehlern beim Aufbau
            einer europäischen AI-Governance-Plattform.
          </p>
          <Link
            to="/enterprise-ai-os/founding-access"
            className="mt-8 inline-flex rounded-2xl bg-[#d4af37] px-6 py-4 font-semibold text-black"
          >
            Kostenlosen Zugang aktivieren
          </Link>
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          Hinweis: RealSyncDynamics AI unterstützt Dokumentation, Risikomanagement und Governance.
          Es ersetzt keine individuelle Rechtsberatung.
        </p>
      </section>
    </main>
  );
}
