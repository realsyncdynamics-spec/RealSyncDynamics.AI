import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  RuntimeKpiCard,
  RuntimeLogStream,
  RuntimeSectionHeader,
  RuntimeTelemetryBar,
} from '../runtime-ui';
import { RUNTIME_DEMO_OVERVIEW } from '../../lib/runtime/runtimeDemoData';

/**
 * Landing-Section, die das Look-and-Feel des Governance-Leitstands
 * mit dem `runtime-ui`-Set sichtbar macht. Bewusst kompakt:
 * - 3 KPI-Karten (Demo)
 * - kompakter Log-Stream
 * - CTA „Runtime oeffnen" -> /leitstand
 *
 * Die Section ist 100% additiv und ersetzt keine bestehende Section.
 */
export function LeitstandPreviewSection() {
  const kpis = RUNTIME_DEMO_OVERVIEW.kpis.slice(0, 3);
  const log  = RUNTIME_DEMO_OVERVIEW.log.slice(0, 5);

  return (
    <section className="border-y border-titanium-900 bg-obsidian-950 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <RuntimeSectionHeader
          eyebrow="Leitstand · Preview"
          title="So sieht die Governance-Runtime in Betrieb aus."
          subtitle="Echtzeit-Ueberwachung, Nachweiskette und Review-Pipeline in einer Surface. Die folgende Vorschau zeigt Demo-Telemetrie — die echte Surface lebt unter /leitstand."
          actions={
            <Link
              to="/leitstand"
              className="inline-flex items-center gap-2 border border-ai-cyan-500/50 bg-ai-cyan-900/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-ai-cyan-200 hover:bg-ai-cyan-900/40"
            >
              Runtime oeffnen <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        <RuntimeTelemetryBar
          source="landing.preview"
          state="demo"
          meta="Beispielereignisse · keine Live-Quelle"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {kpis.map((kpi) => <RuntimeKpiCard key={kpi.id} kpi={kpi} />)}
        </div>

        <div className="mt-4">
          <RuntimeLogStream entries={log} live={false} maxHeight={220} />
        </div>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-titanium-500">
          Demo-Telemetrie · keine Aussage ueber realen Compliance-Stand
        </p>
      </div>
    </section>
  );
}
