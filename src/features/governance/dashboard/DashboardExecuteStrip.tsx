import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';

/** Block 4 — only the path that actually runs. Not the mesh catalog. */
export function DashboardExecuteStrip() {
  return (
    <section
      aria-label="Ausführen"
      data-testid="dashboard-execute-strip"
      className="border border-titanium-900 bg-obsidian-900 px-5 py-4 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <ShieldCheck className="h-4 w-4 text-[#e4cfa2] mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e4cfa2]">Ausführen</p>
          <p className="mt-1 text-sm font-semibold text-titanium-50">Compliance-Prüfung</p>
          <p className="mt-0.5 text-xs text-titanium-400">
            DSGVO und EU AI Act — ausführbar. Agent-OS-Mesh und Coming-Soon liegen unter Agenten.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/app/agents"
          className="inline-flex items-center justify-center gap-2 bg-[#e8ddc8] hover:bg-[#f0e6d4] text-obsidian-950 px-4 py-2 text-sm font-semibold font-mono uppercase tracking-wider"
        >
          Prüfung öffnen <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/app/modules"
          className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-titanium-500 hover:text-[#e4cfa2]"
        >
          Alle Module
        </Link>
      </div>
    </section>
  );
}
