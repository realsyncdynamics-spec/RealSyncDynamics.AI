import { Link } from 'react-router-dom';
import { brandButtonClass } from '../../../components/brand';
import { ArrowRight, ShieldCheck } from 'lucide-react';

/** Block 4 on /app/dashboard — one executable entry, no mesh, no coming-soon. */
export function DashboardExecuteStrip() {
  return (
    <section
      data-testid="dashboard-execute-strip"
      aria-label="Ausführen"
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border border-titanium-900 bg-obsidian-900 px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brand-champ)] flex items-center gap-2">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Ausführen
          </p>
          <p className="mt-1 text-sm text-titanium-200">
            Compliance-Audit einer Domain starten (DSGVO / EU AI Act). Agenten laufen unter{' '}
            <Link to="/app/agents" className="text-[var(--brand-champ)] hover:underline">Agents</Link>.
          </p>
        </div>
        <Link
          to="/audit"
          className={brandButtonClass({ size: 'md' })}
        >
          Prüfung öffnen <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
